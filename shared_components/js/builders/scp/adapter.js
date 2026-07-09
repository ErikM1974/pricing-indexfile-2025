/**
 * ScpAdapter — the SCP method adapter for QuoteBuilderBase (roadmap 0.4).
 *
 * Carries the SCP page's composition-root init VERBATIM (moved from the
 * monolith's DOMContentLoaded listener, S2 2026-07-08) split into the base's
 * two lifecycle hooks, plus the MethodAdapter contract. Mirrors
 * builders/emb/adapter.js — common parts graduate into the base (rule of two).
 *
 * The QuoteOrderSummary.configure() block at the tail runs at MODULE EVAL
 * (bundle parse time), the same pre-DOMContentLoaded timing it had as a
 * top-level statement in the monolith.
 */
/* global ArtworkUpload, StaffAuthHelper, CustomerLookupService,
   CustomerDesignCombobox, ScreenPrintPricingService, ScreenPrintQuoteService,
   QuoteOrderSummary, SafetyStripeRecs, initLogoStatusChips,
   initMethodSwitchMenu, checkForEditMode, getQuickQuotePrefill,
   takeMethodSwitchPrefill, loadServiceCodePrices, getServicePrice,
   setupBeforeUnloadGuard, showRecentCustomerOrders, removeRecentOrdersPanel,
   renderOrderShippingFields, initOrderShippingListeners,
   setupKeyboardShortcuts, showToast */
import { updatePrintConfig } from './print-config.js';
import { loadServiceCodePrices } from '../shared/service-codes.js';
import { setupSearchAutocomplete } from './product-rows.js';
import { recalculatePricing, collectProductsFromTable, updateTaxCalculation } from './pricing-sync.js';
import {
    initScreenPrintPersistence,
    restoreScreenPrintDraft,
    loadQuoteForEditing,
    duplicateQuote,
    addProductFromQuote,
    applyQuickQuotePrefillScp,
    applyMethodSwitchPrefillScp,
} from './persistence.js';
import { scpState } from './state.js';

export class ScpAdapter {
    // ── MethodAdapter contract (typed in types/quote.d.ts) ────────────────
    /** 'scp' */
    method = 'scp';

    /** The live pricing authority (ScreenPrintPricingService instance). */
    getPricingService() {
        return scpState.screenPrintPricingService;
    }

    /**
     * SCP tiers ride per-location on the live bundle (primaryPricing.tiers
     * inside recalculatePricing) — there is no flat instance field like EMB's
     * calculator. Expose what the service has; per-location tiers land here
     * when the base starts driving tier display (0.5+).
     */
    getTierConfig() {
        const svc = scpState.screenPrintPricingService;
        return (svc && (svc.tiers || svc.pricingData || null)) || null;
    }

    /** Print-location model (codes match printConfig + LOCATION_NAMES). */
    getLocationModel() {
        return {
            front: ['LC', 'FF', 'JF'],
            back: ['FB', 'JB'],
            sleeves: ['left', 'right'],
        };
    }

    /** SCP quantity nudge thresholds (2026-06-19 remap; LTM charges through 24-47). */
    getNudgeTiers() {
        return [24, 48, 72, 145];
    }

    /**
     * Row rendering hook — not yet driven by the base (lands when the 0.5
     * quote-model row render replaces per-builder DOM building). SCP rows
     * are currently built by product-rows.js addNewRow/onStyleChange.
     */
    renderMethodSpecificRow(_item, _rowEl) {
        /* intentionally empty until the base drives row rendering (0.5) */
    }

    /** Focus the style search box — the rep's first keystroke target. */
    focusEntry() {
        const searchInput = document.getElementById('product-search');
        if (searchInput) searchInput.focus();
    }

    // ── Lifecycle hook 1: UI wiring that must work even if pricing is down ─
    // D3 split (2026-07-09): the Service_Codes load + live-label sync, moved
    // VERBATIM out of setupPage (fire-and-forget; fallbacks until it resolves).
    _loadScpServiceCodes() {
        // Load Caspio Service_Codes (SPSU screen-setup, GRT-75 design) so fees come
        // from the API, not hardcoded literals (Erik's Pricing=API rule). Fire-and-
        // forget — getServicePrice() returns the documented fallback until it resolves,
        // and recalculatePricing() re-reads live values on the next interaction. (2026-06-09)
        if (typeof loadServiceCodePrices === 'function') { loadServiceCodePrices().then(() => {
            // updatePrintConfig() re-derives printConfig.setupFee from the now-live SPSU rate
            // and ends in recalculateAllPrices(); the old bare recalculatePricing() left the
            // stale fallback $30/screen CHARGED while the fee-row label showed the live rate
            // until the rep happened to click a print-config control. (expert audit 2026-07-07)
            try { updatePrintConfig(); } catch (_) { try { recalculatePricing(); } catch (__) {} }
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
    }

    async setupPage() {

        // Logo status chips — On file / New / TBD (Erik 2026-07-07). SCP's TBD
        // assumption is the COLOR COUNT: the one thing the art changes about price.
        if (typeof initLogoStatusChips === 'function') {
            initLogoStatusChips({
                mountSel: '.logo-section.reference-artwork-section',
                artworkMountSel: '#scp-artwork-mount',
                designFocusId: 'design-number',
                notesSel: '#spc-order-fields .os-notes',
                assumption: () => {
                    const front = /** @type {HTMLInputElement|null} */ (document.querySelector('input[name="front-colors"]:checked'))?.value || '1';
                    const backOn = !!(scpState.printConfig && scpState.printConfig.backLocation);
                    const back = backOn ? (/** @type {HTMLInputElement|null} */ (document.querySelector('input[name="back-colors"]:checked'))?.value || '1') : null;
                    const dark = /** @type {HTMLInputElement|null} */ (document.getElementById('dark-garment-toggle'))?.checked;
                    return `Pricing assumes a ${front}-color front print${back ? ` + ${back}-color back` : ''}${dark ? ' with white underbase' : ''}. Color count is confirmed after artwork review — each added color adds a screen and changes the per-piece price.`;
                }
            });
        }

        // Mid-call method-switch menu (expert audit 2026-07-07) — serializes IDENTITY
        // only (customer + style/color/sizes); the target builder reprices natively.
        if (typeof initMethodSwitchMenu === 'function') {
            initMethodSwitchMenu({
                current: 'scp',
                collect: () => collectProductsFromTable()
                    .filter(p => !p.isService)
                    .map(p => ({
                        style: p.style, color: p.catalogColor || '', colorName: p.color || '',
                        sizeBreakdown: Object.fromEntries(Object.entries(p.sizeBreakdown || {}).filter(([, q]) => (parseInt(q, 10) || 0) > 0))
                    }))
                    .filter(i => i.style && Object.keys(i.sizeBreakdown).length)
            });
        }

        this._loadScpServiceCodes();

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
                    if (/** @type {HTMLInputElement} */ (_spStripeToggle).checked) {
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
                            const v = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-number'))?.value?.trim();
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

    }

    // ── Lifecycle hook 2: pricing service init + entry routing ────────────
    // D3 split (2026-07-09): the ?edit/?duplicate/quick-quote/method-switch/draft
    // entry routing, moved VERBATIM out of initPricingAndRoute's try block.
    async _routeEntryMode() {
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
            if (scpState.spSession && scpState.spSession.shouldShowRecovery()) {
                scpState.spSession.showRecoveryDialog(
                    (draft) => restoreScreenPrintDraft(draft),
                    () => {
                        if (scpState.spPersistence) scpState.spPersistence.clearDraft();
                        // No auto-row - user starts with empty state
                    }
                );
            }
            // No auto-row - empty state message guides user to search
        }
    }

    async initPricingAndRoute() {
        try {
            // Initialize Screen Print pricing service
            scpState.screenPrintPricingService = new ScreenPrintPricingService();

            // Initialize quote service for save/load
            scpState.quoteService = new ScreenPrintQuoteService();

            await this._routeEntryMode();

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
                    /** @type {HTMLInputElement} */ (document.getElementById('customer-name')).value = contact.ct_NameFull || '';
                    /** @type {HTMLInputElement} */ (document.getElementById('customer-email')).value = contact.ContactNumbersEmail || '';
                    /** @type {HTMLInputElement} */ (document.getElementById('company-name')).value = contact.CustomerCompanyName || '';
                    // ShopWorks customer # — so the pushed order attaches to the real
                    // customer instead of the no-customer fallback (2026-06-01).
                    const _custNumEl = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-number'));
                    if (_custNumEl && contact.id_Customer != null) _custNumEl.value = String(contact.id_Customer);

                    // [2026-06-08] P0 (Erik's #1 rule): honor tax-exempt customers — the CRM "TAX EXEMPT" chip was
                    // cosmetic; the quote/PDF/push still billed WA tax. Mirror EMB. Also restore tax for a taxable
                    // customer selected right after an exempt one (else the prior 0% bleeds → under-charge).
                    var _wasExempt = !!window._taxExempt;
                    window._taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                    var _incTax = document.getElementById('include-tax');
                    var _rateEl = document.getElementById('tax-rate-input');
                    if (window._taxExempt) {
                        if (_incTax) /** @type {HTMLInputElement} */ (_incTax).checked = false;
                        if (_rateEl) /** @type {HTMLInputElement} */ (_rateEl).value = '0';
                        updateTaxCalculation();
                    } else if (_wasExempt) {
                        if (_incTax) /** @type {HTMLInputElement} */ (_incTax).checked = true;
                        if (_rateEl && /** @type {HTMLInputElement} */ (_rateEl).value === '0') /** @type {HTMLInputElement} */ (_rateEl).value = '10.2';
                        updateTaxCalculation();
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
                        /** @type {HTMLInputElement} */ (document.getElementById('customer-name')).value = '';
                        /** @type {HTMLInputElement} */ (document.getElementById('customer-email')).value = '';
                        /** @type {HTMLInputElement} */ (document.getElementById('company-name')).value = '';
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
                        const lookupInput = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-lookup'));
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
                    if (window._taxExempt || window._isWholesale) { const ri = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input')); if (ri) ri.value = '0'; updateTaxCalculation(); return; }
                    const rateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'));
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

            showToast('Ready to build Screen Print quotes!', 'success');

        } catch (error) {
            console.error('Failed to initialize:', error);
            showToast('Failed to initialize. Please refresh.', 'error');
        }
    }
}

// [2026-06-08] Shared order-summary band (Order Recap + Ship-To card) — DTF/SCP parity Phase 3.
// SCP ship fields are CLASS-based (.os-*) inside the single #spc-order-fields panel rendered by the shared
// renderOrderShippingFields(); selectors are scoped to that container so getShipFields()'s querySelector resolves
// uniquely. Fee class is .os-shipping-fee. No #it-shipping-amt (recap drops the Shipping row), no logo model.
// Estimator IS wired (estimateHooks below → Re-estimate shows); no modal → editOnclick omitted → no Edit. The .os-* panel + its tax
// listeners are SHARED (quote-builder-utils.js) and were NOT touched — the ship-field render hooks are SCP-local
// listeners attached in initPricingAndRoute (the .os-ship-* forEach). quote-order-summary.js loads before this bundle.
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
            collectProducts: function () { return collectProductsFromTable(); },
            onApplied: function () { try { recalculatePricing(); } catch (_) {} },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}
