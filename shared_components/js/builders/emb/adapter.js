/**
 * EmbAdapter — the EMB method adapter for QuoteBuilderBase (roadmap 0.4).
 *
 * Carries the EMB page's composition-root init VERBATIM (moved from the
 * monolith's DOMContentLoaded listener, 2026-07-07) split into the base's
 * two lifecycle hooks, plus the MethodAdapter contract. As SCP/DTF adapt,
 * the common parts (services-bar shape, customer-panel wiring, the
 * ?edit/?duplicate/prefill routing skeleton) graduate into the base.
 */
// @ts-nocheck — MOVED legacy init code (pre-existing checkJs frictions).
/* global ArtworkUpload, StaffAuthHelper, CustomerLookupService,
   EmbroideryPricingCalculator, EmbroideryQuoteService, initLogoStatusChips,
   initMethodSwitchMenu, checkForEditMode, getQuickQuotePrefill,
   clearQuickQuoteParams, takeMethodSwitchPrefill, applyMethodSwitchCustomer,
   setQuoteDateDefaults, setupBeforeUnloadGuard, showRecentCustomerOrders,
   removeRecentOrdersPanel, renderOrderRecap, showToast,
   setupKeyboardShortcuts, history */
import { loadServiceCodePrices, getServicePrice } from './pricing.js';
import { setupSearchAutocomplete, setupPrimaryLogoHandlers, setupCapPrimaryLogoHandlers,
         addALLineItem, addDECGLineItem, addManualServiceRow } from './product-rows.js';
import { updatePushButtonState } from './save-push.js';
import { lookupTaxRate, updateTaxCalculation, recalculatePricing, collectProductsFromTable,
         onShipMethodChange, syncDigitizingPriceLabels, updateDigitizingNudges } from './pricing-sync.js';
import { invalidateDesignGalleryCache } from './design-search.js';
import { clearCustomerContextBanners, setupUnsavedChangesTracking, updateAdditionalCharges } from './quote-lifecycle.js';
import { updateNotesBadge, updateStitchTierDropdownLabels, initStitchEstimators } from './logo-config.js';
import { embState } from './state.js';
import { initEmbroideryPersistence, loadQuoteForEditing, duplicateQuote, addProductFromQuote,
         restoreEmbroideryDraft } from './persistence.js';

export class EmbAdapter {
    // ── MethodAdapter contract (typed in types/quote.d.ts) ────────────────
    /** 'emb' */
    method = 'emb';

    /** The live pricing authority (EmbroideryPricingCalculator instance). */
    getPricingService() {
        return embState.pricingCalculator;
    }

    /** EMB tier facts from the live pricing service (LTM threshold qty<=7; caps+garments tier separately). */
    getTierConfig() {
        // EmbroideryPricingCalculator hangs tiers + margins directly off the instance
        // (tiers, marginDenominator, ltmFee — all hydrated from /api/pricing-bundle).
        return (embState.pricingCalculator && embState.pricingCalculator.tiers) || null;
    }

    /** Logo/decoration location model (primary + AL placements). */
    getLocationModel() {
        return {
            primary: ['Left Chest', 'Right Chest', 'Full Back', 'Left Sleeve', 'Right Sleeve'],
            cap: ['CF', 'Cap Back', 'Cap Side'],
            additional: ['Left Chest', 'Right Chest', 'Left Sleeve', 'Right Sleeve', 'Back/Nape', 'Full Back',
                         'Cap Front', 'Cap Back', 'Cap Side'],
        };
    }

    /** EMB quantity nudge thresholds (UI constants — see MEMORY nudge tiers). */
    getNudgeTiers() {
        return [8, 24, 48, 72];
    }

    /**
     * Row rendering hook — not yet driven by the base (lands when the 0.5
     * quote-model row render replaces per-builder DOM building). EMB rows
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
    async setupPage() {

        // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
        // Adds design name input + per-file placement dropdown so the push payload
        // can carry Designs[{name, Locations[{Location, ImageURL}]}] for new-design
        // pushes. Mirrors DTF/SCP wiring (commit 8056aeaa, 20c96945).
        //
        // Phase 9.1 RESOLVED (2026-05-24, Phase 11.3d): EMB persistence chose
        // option (c) — repurpose ImportNotes from array → object so referenceArtwork
        // and newDesignName ride alongside the existing import-notes array. Proxy's
        // embroidery-push-transformer.js handles both shapes (legacy array kept
        // working). Quote-service writes the object form in customerData.
        if (typeof ArtworkUpload !== 'undefined') {
            try {
                window._embArtwork = ArtworkUpload.attach({
                    mountSelector: '#emb-artwork-mount',
                    designName: {
                        enabled: true,
                        label: 'Design name (required when uploading new artwork)',
                        placeholder: 'e.g. Acme Corp Logo',
                    },
                    placements: [
                        { code: 'Left Chest',   label: 'Left Chest' },
                        { code: 'Right Chest',  label: 'Right Chest' },
                        { code: 'Full Back',    label: 'Full Back' },
                        { code: 'Left Sleeve',  label: 'Left Sleeve' },
                        { code: 'Right Sleeve', label: 'Right Sleeve' },
                        { code: 'Cap Front',    label: 'Cap Front' },
                        { code: 'Cap Side',     label: 'Cap Side' },
                        { code: 'Cap Back',     label: 'Cap Back' },
                        { code: 'Beanie Front', label: 'Beanie Front' },
                    ],
                    defaultPlacement: 'Left Chest',
                });
            } catch (e) {
                console.error('[EMB] Artwork widget mount failed:', e);
            }
        }


        // ALWAYS set up search first - independent of pricing calculator
        // This ensures search works even if pricing API fails
        setupSearchAutocomplete();
        setupKeyboardShortcuts();
        setupPrimaryLogoHandlers();
        setupCapPrimaryLogoHandlers();  // Cap logo handlers

        // Services bar (2026-06-03): a persistent, catalog-driven "Add to order" strip.
        // Click a chip → addManualServiceRow(code) inserts an editable LINE ITEM. Same
        // shared bar (quote-services-bar.js) will drive SCP/DTG/DTF with their own catalogs.
        if (window.QuoteServicesBar) {
            // Part numbers + descriptions match the real ShopWorks line items (Erik's
            // test order 142021). Codes are registered in the proxy KNOWN_FEE_PNS so
            // they push as LinesOE line items. Not here (auto from the top config): AL,
            // AL-CAP, DECG-FB (Full Back), 3D-EMB, Laser Patch, LTM, DD (Digitizing).
            // Prices pulled from Caspio Service_Codes via /api/service-codes (single source
            // of truth). Non-blocking: render once prices load (or fall back to defaults +
            // a visible warning if the API is unreachable). Change a price in Caspio → the
            // bar reflects it on next load, no deploy needed.
            loadServiceCodePrices().finally(() => {
                // Digitizing labels + new-logo nudge react to live Service_Codes and to
                // design-number typing (recalc doesn't fire on keystrokes). (2026-07-07)
                try {
                    syncDigitizingPriceLabels();
                    updateDigitizingNudges();
                    ['garment-design-number', 'cap-design-number'].forEach(id => {
                        document.getElementById(id)?.addEventListener('input', updateDigitizingNudges);
                    });
                } catch (_) {}
                const sp = (code, fb) => getServicePrice(code, fb);
                const EMB_SERVICE_CATALOG = [
                    { group: 'Artwork', icon: 'fa-palette', items: [
                        { code: 'GRT-50', label: 'Logo Mockup & Review', price: sp('GRT-50', 50),  unit: 'flat', icon: 'fa-palette' },
                        { code: 'GRT-75', label: 'Graphic Design',       price: sp('GRT-75', 75),  unit: 'hr',   icon: 'fa-pencil-ruler' },
                        { code: 'DD',     label: 'Digitizing',           price: sp('DD', 100),     unit: 'flat', icon: 'fa-cog' },
                        // Additional Logo — live-priced per-piece from the API (calculateALPrice,
                        // tier-aware + per-1K stitch upcharge). Pick Garment/Cap + size, then enter qty.
                        { code: 'AL', label: 'Additional Logo', icon: 'fa-clone', addLabel: 'Add Logo', fields: [
                            // Placement drives BOTH where it prints AND the pricing path
                            // (Full Back → full-back rate, Cap* → cap rate, else garment rate).
                            { name: 'placement', label: 'Where', options: [
                                { group: 'Garment', options: [
                                    { value: 'Left Chest',   label: 'Left Chest' },
                                    { value: 'Right Chest',  label: 'Right Chest' },
                                    { value: 'Left Sleeve',  label: 'Left Sleeve' },
                                    { value: 'Right Sleeve', label: 'Right Sleeve' },
                                    { value: 'Back/Nape',    label: 'Back / Nape' },
                                    { value: 'Full Back',    label: 'Full Back' }
                                ]},
                                { group: 'Cap', options: [
                                    { value: 'Cap Front', label: 'Cap Front' },
                                    { value: 'Cap Back',  label: 'Cap Back' },
                                    { value: 'Cap Side',  label: 'Cap Side' }
                                ]}
                            ]},
                            // Simple by default (Std/Mid/Large chips) — exact when it matters (type the count).
                            { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                                { label: 'Std',   value: 8000 },
                                { label: 'Mid',   value: 13000 },
                                { label: 'Large', value: 20000 }
                            ]}
                        ]}
                    ]},
                    { group: 'Add-Ons', icon: 'fa-stamp', items: [
                        { code: 'Monogram', label: 'Monogram', price: sp('Monogram', 12.50), unit: 'ea', icon: 'fa-font' },
                        { code: 'RUSH',     label: 'Rush Fee', priceLabel: '25% of subtotal', icon: 'fa-bolt' }
                    ]},
                    // Customer-Supplied: the customer brings their OWN blanks (corporate Costco jackets,
                    // etc.) — we charge embroidery ONLY, no garment, at higher DECG tiers (no garment
                    // margin). Live-priced per-piece from /api/decg-pricing (Embroidery_Costs DECG-Garmt /
                    // DECG-Cap), garment vs cap by chip. Pick stitches, then set the qty on the line.
                    { group: 'Customer-Supplied', icon: 'fa-box-open', items: [
                        { code: 'DECG', label: 'Customer Garment', icon: 'fa-tshirt', addLabel: 'Add', priceLabel: 'embroidery only', fields: [
                            { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                                { label: 'Std', value: 8000 }, { label: 'Mid', value: 13000 }, { label: 'Large', value: 20000 }
                            ]},
                            { name: 'heavyweight', label: 'Heavyweight +$10', type: 'checkbox' }
                        ]},
                        { code: 'DECC', label: 'Customer Cap', icon: 'fa-hat-cowboy', addLabel: 'Add', priceLabel: 'embroidery only', fields: [
                            { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                                { label: 'Std', value: 8000 }, { label: 'Mid', value: 13000 }, { label: 'Large', value: 20000 }
                            ]},
                            { name: 'heavyweight', label: 'Heavyweight +$10', type: 'checkbox' }
                        ]}
                    ]}
                ];
                window.QuoteServicesBar.render('emb-services-bar', EMB_SERVICE_CATALOG,
                    (code, opts) => {
                        if (code === 'AL' && opts && opts.fields) {
                            addALLineItem(opts.fields.placement, opts.fields.stitches);
                        } else if ((code === 'DECG' || code === 'DECC') && opts && opts.fields) {
                            addDECGLineItem(code === 'DECC' ? 'cap' : 'garment', opts.fields.stitches, opts.fields.heavyweight);
                        } else {
                            addManualServiceRow(code, opts && opts.price);
                        }
                    });
            });
        }

        // Gated "Push to ShopWorks" button: re-evaluate when the Customer # changes,
        // and set its initial (disabled) state for a fresh quote.
        const _custNumEl = document.getElementById('customer-number');
        if (_custNumEl) _custNumEl.addEventListener('input', updatePushButtonState);
        // [A5] (audit 2026-06-06): on change, verify the typed Customer # against CRM and show the resolved
        // company (or warn) — catches a transposed-but-valid # before it silently pushes to a wrong account.
        if (_custNumEl) _custNumEl.addEventListener('change', async () => {
            if (window._restoringQuote) return;
            const id = (_custNumEl.value || '').trim();
            const noteEl = document.getElementById('customer-number-resolved');
            if (!noteEl) return;
            if (!id) { noteEl.textContent = ''; noteEl.hidden = true; return; }
            if (!window.customerLookupInstance) return;
            const contact = await window.customerLookupInstance.getByCustomerId(id);
            if ((_custNumEl.value || '').trim() !== id) return;   // value changed mid-await — ignore stale result
            if (contact && contact.CustomerCompanyName) {
                noteEl.textContent = '✓ ' + contact.CustomerCompanyName;
                noteEl.style.cssText = 'font-size:11px;color:#166534;font-weight:600;display:block;margin-top:2px;';
                noteEl.hidden = false;
            } else {
                noteEl.textContent = '⚠ No CRM customer for #' + id + ' — verify before pushing.';
                noteEl.style.cssText = 'font-size:11px;color:#92400e;font-weight:600;display:block;margin-top:2px;';
                noteEl.hidden = false;
            }
        });
        const _custNameEl = document.getElementById('customer-name');   // keep the push-readiness "Customer name" check live (audit #8)
        if (_custNameEl) _custNameEl.addEventListener('input', updatePushButtonState);
        const _custEmailEl = document.getElementById('customer-email');  // P2-15 (audit 2026-06-06): re-enable Push when Email is the last field typed
        if (_custEmailEl) _custEmailEl.addEventListener('input', updatePushButtonState);
        updatePushButtonState();

        // Auto-select sales rep based on logged-in staff (2026 consolidation)
        if (typeof StaffAuthHelper !== 'undefined') {
            StaffAuthHelper.autoSelectSalesRep('sales-rep');
        }

        // Initialize customer lookup autocomplete
        if (typeof CustomerLookupService !== 'undefined') {
            const customerLookup = new CustomerLookupService();
            window.customerLookupInstance = customerLookup;  // Store for ShopWorks import

            const applyContact = (contact) => {
                document.getElementById('customer-name').value = contact.ct_NameFull || '';
                document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                document.getElementById('company-name').value = contact.CustomerCompanyName || '';
                // Fill customer number (ShopWorks ID)
                document.getElementById('customer-number').value = contact.id_Customer || '';
                // Phone — API may not return phone, clear if empty
                const phoneInput = document.getElementById('customer-phone');
                if (phoneInput) phoneInput.value = contact.Phone || '';
                // Auto-fill Ship To from contact address. STASH it always so that if
                // the rep later flips Pickup → Ship it, setShipMode() restores it.
                // When Pickup is active (the default), do NOT overwrite the Milton shop
                // address / tax — a pickup order is taxed locally. (2026-06-02)
                window._lastCustomerShipTo = {
                    address: contact.Address || '',
                    city: contact.City || '',
                    state: contact.State || '',
                    zip: contact.Zip || ''
                };
                const _isPickup = (document.getElementById('ship-method')?.value === 'Customer Pickup');
                // P1-2 (audit 2026-06-06): a tax-exempt customer must NOT be charged WA sales tax — the CRM
                // chip is cosmetic. Clear the tax here (uncheck include-tax + zero the rate) and DO NOT run the
                // DOR lookup (its async result would overwrite the 0 — same race as the P0 pickup bug). #1 rule.
                const _taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                // [B8 + B8-R1] (audit 2026-06-06): persist exemption BEFORE the ship-field block below runs
                // lookupTaxRate — otherwise a NEW non-exempt customer selected right after an exempt one would see
                // the prior customer's stale window._taxExempt=true and get forced to 0% (under-charge). Also stops
                // a later Pickup→Ship toggle re-applying WA tax to an exempt customer. #1 rule.
                window._taxExempt = _taxExempt;
                if (!_isPickup) {
                    if (contact.State) { const el = document.getElementById('ship-state'); if (el) el.value = contact.State; }
                    if (contact.City) { const el = document.getElementById('ship-city'); if (el) el.value = contact.City; }
                    if (contact.Address) { const el = document.getElementById('ship-address'); if (el) el.value = contact.Address; }
                    if (contact.Zip) {
                        const zipInput = document.getElementById('ship-zip');
                        if (zipInput) { zipInput.value = contact.Zip; if (!_taxExempt) lookupTaxRate(); }
                    }
                }
                if (_taxExempt) {
                    const incTax = document.getElementById('include-tax');
                    if (incTax) incTax.checked = false;
                    const rateInput = document.getElementById('tax-rate-input');
                    if (rateInput) rateInput.value = '0';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                }
                invalidateDesignGalleryCache(); // Invalidate gallery cache on customer change

                // Surface CRM context (Erik 2026-05-23) — Customer Warning banner +
                // Tax Exempt chip + Account Tier badge + payment terms auto-fill
                // with legacy-CRM mapping. Defensive — only fires if the shared
                // helper loaded (script tag may not be present on older builds).
                if (typeof window.surfaceCustomerContext === 'function') {
                    window.surfaceCustomerContext(contact, {
                        warningContainerId: 'customer-warning-banner',
                        taxChipContainerId: 'customer-tax-chip',
                        tierBadgeContainerId: 'customer-tier-badge',
                        phoneInputId: 'customer-phone',
                        termsSelectId: 'payment-terms',
                        termsNoteId: 'customer-terms-note',
                        offeredTerms: ['Prepaid', 'Net 10', 'Pay On Pickup'],
                    });
                }

                renderOrderRecap();  // customer set → refresh the bottom Order Recap
                updatePushButtonState();  // customer # set programmatically (no 'input' event) → re-enable Push + refresh checklist (review C9 2026-06-05)
                showToast('Customer info loaded', 'success');

                // Recent ShopWorks orders panel (advisory re-order aid; silent-skip on failure) —
                // shared showRecentCustomerOrders() in quote-builder-utils.js. (item #13, 2026-07-05)
                if (typeof showRecentCustomerOrders === 'function' && contact.id_Customer) {
                    showRecentCustomerOrders(contact.id_Customer, {
                        notesId: 'notes', projectId: 'project-name', poId: 'po-number'
                    });
                }
            };

            customerLookup.bindToInput('customer-lookup', {
                onSelect: applyContact,
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                    document.getElementById('customer-number').value = '';
                    const phoneInput = document.getElementById('customer-phone');
                    if (phoneInput) phoneInput.value = '';
                    invalidateDesignGalleryCache(); // Invalidate gallery cache on customer clear
                    clearCustomerContextBanners();  // P2-8: don't bleed the prior customer's CRM banners
                    if (typeof removeRecentOrdersPanel === 'function') removeRecentOrdersPanel();  // item #13: no stale orders for the next customer
                }
            });

            // Erik 2026-05-26: COMPANY field also triggers autocomplete (DTG parity).
            customerLookup.bindToInput('company-name', {
                onSelect: (contact) => {
                    const lookupInput = document.getElementById('customer-lookup');
                    if (lookupInput) lookupInput.value = contact.CustomerCompanyName || '';
                    applyContact(contact);
                }
            });
        }

        // Notes textarea badge update on input
        const notesTextarea = document.getElementById('notes');
        if (notesTextarea) {
            notesTextarea.addEventListener('input', updateNotesBadge);
        }

        // Setup unsaved changes tracking for form fields (UX improvement)
        setupUnsavedChangesTracking();
        // Native leave-page warning while changes are unsaved (audit 2026-06-10)
        if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();

    }

    // ── Lifecycle hook 2: pricing service init + entry routing ────────────
    async initPricingAndRoute() {
        try {
            // Initialize pricing calculator
            embState.pricingCalculator = new EmbroideryPricingCalculator();
            await embState.pricingCalculator.initializeConfig();
            updateStitchTierDropdownLabels();
            initStitchEstimators();   // 📐 estimate-from-logo-size buttons (2026-06-10)

            // Initialize quote service
            embState.quoteService = new EmbroideryQuoteService();

            // Check for edit mode (loading existing quote for revision)
            // Logo status chips — On file / New / TBD (Erik 2026-07-07). "New" auto-adds
            // the new-logo setup (the most-forgotten $100); "TBD" writes the pricing
            // assumption into #notes so it saves/prints/emails with the quote.
            if (typeof initLogoStatusChips === 'function') {
                initLogoStatusChips({
                    mountSel: '.logo-config-container',
                    artworkMountSel: '#emb-artwork-mount',
                    designFocusId: 'garment-design-number',
                    notesSel: '#notes',
                    assumption: () => {
                        const tierSel = document.getElementById('primary-stitches');
                        const tierText = tierSel ? (tierSel.options[tierSel.selectedIndex]?.text || 'Standard (≤10K)') : 'Standard (≤10K)';
                        const pos = document.getElementById('primary-position')?.value || 'Left Chest';
                        return `Pricing assumes a ${tierText} embroidered logo at ${pos}. Final pricing is confirmed after artwork review; a new logo adds a one-time new-logo setup fee.`;
                    },
                    onNew: () => {
                        const cb = document.getElementById('primary-digitizing');
                        if (cb && !cb.checked) {
                            cb.checked = true;
                            cb.closest('.digitizing-checkbox')?.classList.add('checked');
                            if (typeof embState.primaryLogo !== 'undefined' && embState.primaryLogo) embState.primaryLogo.needsDigitizing = true;
                            showToast('New logo — added the one-time new-logo setup. Uncheck it if we\'ve stitched this logo before.', 'info', 6000);
                            recalculatePricing();
                        }
                    }
                });
            }

            // Mid-call method-switch menu (expert audit 2026-07-07) — serializes IDENTITY
            // only (customer + style/color/sizes); the target builder reprices natively.
            if (typeof initMethodSwitchMenu === 'function') {
                initMethodSwitchMenu({
                    current: 'emb',
                    collect: () => (typeof collectProductsFromTable === 'function' ? collectProductsFromTable() : [])
                        .filter(p => !p.isService)
                        .map(p => ({
                            style: p.style, color: p.catalogColor || '', colorName: p.color || '',
                            sizeBreakdown: Object.fromEntries(Object.entries(p.sizeBreakdown || {}).filter(([, q]) => (parseInt(q, 10) || 0) > 0))
                        }))
                        .filter(i => i.style && Object.keys(i.sizeBreakdown).length)
                });
            }

            const editQuoteId = checkForEditMode();
            // Duplicate mode (?duplicate=EMB-2026-123): load a copy as a NEW quote (2026-06-10)
            const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
            // Quick Quote handoff (?from=quickquote — param schema + parser in
            // quote-builder-utils.js getQuickQuotePrefill()). Prefill flows through the
            // SAME addProductFromQuote() path edit-load uses, so pricing/color/size
            // handling is identical to a hand-added row. (item #6, 2026-07-05)
            const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
            if (duplicateQuoteId) {
                await duplicateQuote(duplicateQuoteId);
            } else if (editQuoteId) {
                // Skip draft recovery and load the existing quote instead
                await loadQuoteForEditing(editQuoteId);
            } else if (qqPrefill) {
                // Prefill wins over draft recovery for this visit (like ?edit=/?duplicate=).
                initEmbroideryPersistence();
                if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
                try {
                    await addProductFromQuote({
                        styleNumber: qqPrefill.style,
                        color: qqPrefill.color || qqPrefill.colorName,
                        sizeBreakdown: qqPrefill.sizeBreakdown
                    });
                    showToast('Loaded ' + qqPrefill.style + ' from Quick Quote — verify color, quantities & pricing', 'info', 6000);
                } catch (e) {
                    console.error('[QuickQuote prefill] failed:', e);
                    showToast('Could not prefill ' + qqPrefill.style + ' from Quick Quote — add it manually', 'warning', 6000);
                }
                if (typeof clearQuickQuoteParams === 'function') clearQuickQuoteParams();
            } else if (typeof takeMethodSwitchPrefill === 'function' && (window._msPrefillEmb = takeMethodSwitchPrefill())) {
                // Mid-call method switch (?from=methodswitch — expert audit 2026-07-07):
                // customer + product rows carried over from another builder; each row
                // replays through the SAME addProductFromQuote() path as Quick Quote.
                const ms = window._msPrefillEmb;
                initEmbroideryPersistence();
                if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
                if (typeof applyMethodSwitchCustomer === 'function') applyMethodSwitchCustomer(ms.customer);
                let msAdded = 0;
                for (const p of (ms.products || [])) {
                    try {
                        await addProductFromQuote({
                            styleNumber: p.style,
                            color: p.color || p.colorName,
                            sizeBreakdown: p.sizeBreakdown || {}
                        });
                        msAdded++;
                    } catch (e) {
                        console.error('[MethodSwitch] product prefill failed:', p.style, e);
                        showToast('Could not carry ' + p.style + ' over — add it manually', 'warning', 6000);
                    }
                }
                showToast(`Switched from ${ms.fromLabel || 'another builder'} — customer + ${msAdded} product${msAdded === 1 ? '' : 's'} carried over. Configure the logos.`, 'success', 7000);
                try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
            } else {
                // Initialize auto-save & draft recovery (2026 consolidation)
                initEmbroideryPersistence();

                // New-quote date defaults (2026-06-02): Date Placed = today,
                // Req Ship Date = today + 2 weeks. Fills blanks only, so a draft
                // restored from the recovery dialog still overrides these.
                if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();

                // Check for draft recovery
                if (embState.embSession && embState.embSession.shouldShowRecovery()) {
                    embState.embSession.showRecoveryDialog(
                        (draft) => restoreEmbroideryDraft(draft),
                        () => {
                            if (embState.embPersistence) embState.embPersistence.clearDraft();
                            // No auto-row - user starts with empty state
                        }
                    );
                }
                // No auto-row - empty state message guides user to search
            }

            showToast('Ready to build quotes!', 'success');

            // Initialize additional charges display (for default $50 art charge)
            updateAdditionalCharges();

            // Paint the Shipping step's Pickup/Ship toggle + pickup-vs-address UI to
            // match the current ship method (Pickup by default on a new quote; the
            // loaded value when editing). Idempotent. (2026-06-02 order-flow redesign)
            onShipMethodChange();

        } catch (error) {
            console.error('Failed to initialize pricing:', error);
            showToast('Pricing unavailable. Search still works.', 'warning');
        }
    }
}
