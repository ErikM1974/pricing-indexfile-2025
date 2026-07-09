/**
 * DTFQuoteBuilder class — DTF decomposition D1 (2026-07-08).
 * The whole builder class VERBATIM (state is `this.`-scoped; childRows Map =
 * the single money source for calculateFromState/computeFeesAndTotals — see
 * dtf-childrow-state.test.js, which locks methods from THIS file). The
 * reprice-pill prototype wrap rides at the tail (monolith-verbatim).
 */
/* global dtfQuoteBuilder, DTFPricingService, DTFQuoteService, escapeHtml, showToast,
   formatPrice, Event, emailjs, QuotePersistence, QuoteSession, initLogoStatusChips,
   initMethodSwitchMenu, getQuickQuotePrefill, takeMethodSwitchPrefill, StaffAuthHelper,
   CustomerLookupService, updateTaxCalculation, showRecentCustomerOrders,
   removeRecentOrdersPanel, setupBeforeUnloadGuard, getServicePrice, updateAdditionalCharges,
   updateFeeTableRows, addNewRow, onStyleChange, selectColor, createChildRow, removeChildRow,
   updateExtendedSizeDisplay, applyMethodSwitchCustomer, history, clearQuickQuoteParams,
   assertQuoteEditable, setLtmControlState, getLtmControlState, renderLtmControlPanel,
   initLtmControlListeners, updatePerUnitPrice, updateQuantityNudge, parseRatePercent, alert,
   isValidEmail, QuoteShareModal, showSaveModal, EmbroideryInvoiceGenerator, confirm,
   requestAnimationFrame, QuoteOrderSummary, wrapWithRepricingIndicator, showDtfPushButton,
   updateDtfPushButtonState */
import { pricingMethods } from './methods-pricing.js';
import { rowsMethods } from './methods-rows.js';
import { locationsMethods } from './methods-locations.js';
import { lifecycleMethods } from './methods-lifecycle.js';
import { outputMethods } from './methods-output.js';

export class DTFQuoteBuilder {
    constructor() {
        // State
        this.selectedLocations = [];
        this.products = [];
        this.pricingData = null;
        this.productIndex = 0;

        // Extended-size child-row state — the SINGLE money source for
        // calculateFromState()/getTotalQuantity()/save/print. DOM child rows are
        // display-only. dtf-quote-page.js mirrors every DOM mutation here at the
        // same chokepoints (createChildRow / onChildSizeChange / removeChildRow /
        // parent-2XL sync). Keyed by numeric childRowId. (2026-06-11 P2 closure)
        this.childRows = new Map(); // childRowId → { parentId, size, qty, baseCost, sizeUpcharges }

        // Edit mode state
        this.editingQuoteId = null;
        this.editingRevision = null;
        // Duplicate mode (?duplicate=DTF-...): source quote id — keeps the loaded
        // Notes meta (design link / artwork refs) flowing into the NEW quote's save
        this._duplicatedFromQuoteId = null;

        // Unsaved changes tracking
        this.hasChanges = false;

        // Auto-save & Draft Recovery (2026 consolidation)
        this.persistence = null;
        this.session = null;
        /** @type {any} */ (this).initPersistence();

        // Location configuration
        this.locationConfig = {
            'left-chest': { label: 'Left Chest', size: 'Small', zone: 'front' },
            'right-chest': { label: 'Right Chest', size: 'Small', zone: 'front' },
            'left-sleeve': { label: 'Left Sleeve', size: 'Small', zone: 'sleeves' },
            'right-sleeve': { label: 'Right Sleeve', size: 'Small', zone: 'sleeves' },
            'back-of-neck': { label: 'Back of Neck', size: 'Small', zone: 'back' },
            'center-front': { label: 'Center Front', size: 'Medium', zone: 'front' },
            'center-back': { label: 'Center Back', size: 'Medium', zone: 'back' },
            'full-front': { label: 'Full Front', size: 'Large', zone: 'front' },
            'full-back': { label: 'Full Back', size: 'Large', zone: 'back' }
        };

        // Conflict zones - front and back are mutually exclusive within zone
        this.conflictZones = {
            front: ['left-chest', 'right-chest', 'center-front', 'full-front'],
            back: ['back-of-neck', 'center-back', 'full-back'],
            sleeves: ['left-sleeve', 'right-sleeve'] // Independent - both allowed
        };

        // Services
        this.quoteService = new window.DTFQuoteService();
        this.pricingCalculator = new window.DTFQuotePricing();
        this.productsManager = new window.DTFQuoteProducts();

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(window.APP_CONFIG.EMAIL.PUBLIC_KEY);
        }

        // Initialize
        /** @type {any} */ (this).init();
    }

}
// ── Prototype assembly (Batch 4.2): the 69 methods live in 5 cluster mixins;
//    bodies are verbatim, so `this.` state and the childRows money contract
//    (dtf-childrow-state.test.js locks prototype methods) are untouched. ──
Object.assign(DTFQuoteBuilder.prototype, pricingMethods, rowsMethods, locationsMethods, lifecycleMethods, outputMethods);


// [2026-06-08] Shared order-summary band (Order Recap + Ship-To card) — DTF/SCP parity Phase 2.
// DTF selector map: fee is #dtf-shipping-fee (not #shipping-fee); no #ship-residential; no #it-shipping-amt
// (recap drops the Shipping row); no logo model (logos omitted). Estimator IS wired (estimateHooks below → the
// module auto-sets _cfg.estimate → Re-estimate shows); no modal → editOnclick omitted → no Edit button. quote-order-summary.js loads before this file.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: {
            address: '#ship-address',
            city: '#ship-city',
            state: '#ship-state',
            zip: '#ship-zip',
            method: '#ship-method',
            fee: '#dtf-shipping-fee',
            residential: '#ship-residential',
        },
        recap: {
            company: '#company-name',
            name: '#customer-name',
            custNum: '#customer-number',
        },
        // [2026-06-08] Commit 5: DTF adopts the shared UPS-Ground estimator. configure() auto-points _cfg.estimate
        // at the module estimator when estimateHooks is present, so the ship-to card's Re-estimate button auto-lights.
        // DTF products are {styleNumber, quantities} → remap to the estimator's {style, sizeBreakdown}.
        estimateHooks: {
            collectProducts: function () {
                return (window.dtfQuoteBuilder && dtfQuoteBuilder.products ? dtfQuoteBuilder.products : [])
                    .map(function (p) { return { style: p.styleNumber, sizeBreakdown: p.quantities }; })
                    .filter(function (p) { return p.style && Object.values(p.sizeBreakdown || {}).some(function (q) { return (parseInt(q) || 0) > 0; }); });
            },
            onApplied: function () {
                if (typeof updateAdditionalCharges === 'function') updateAdditionalCharges();
                if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
            },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// In-flight reprice pill (old-audit price-display #5, 2026-07-07) — see utils.
if (typeof wrapWithRepricingIndicator === 'function') {
    DTFQuoteBuilder.prototype.updatePricing = wrapWithRepricingIndicator(DTFQuoteBuilder.prototype.updatePricing);
}
