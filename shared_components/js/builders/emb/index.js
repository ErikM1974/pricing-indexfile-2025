/**
 * Embroidery quote builder — ESM entry point (Phase 0 strangler shell).
 *
 * Task 0.4 extracts embroidery-quote-builder.js into modules here. Each
 * extracted function is re-exported onto window from THIS file (the one
 * sanctioned re-export surface — see eslint.config.mjs) until every caller
 * is migrated, then the window copy is dropped.
 *
 * Built by scripts/build.js into a hashed IIFE bundle; the page loads it
 * LAST (after the monolith), and it executes at parse time — strictly
 * before DOMContentLoaded, so init-time callers always find the bridges.
 *
 * Extracted so far (map → memory/emb-decomposition-plan.md):
 *   pricing.js       — Service_Codes fee loading (cluster #0, 2026-07-07)
 *   design-search.js — design lookup/gallery modal (cluster #1, 2026-07-07)
 *   spr-modal.js     — service-pricing-review modal (cluster #2, 2026-07-07)
 *   shopworks-import.js — paste-from-ShopWorks import flow (cluster #3, 2026-07-07)
 *   persistence.js   — autosave/draft/edit-load/duplicate (cluster #4, 2026-07-07)
 *   output.js        — print/email/copy + diagnostics (cluster #5, 2026-07-07)
 *   save-push.js     — save orchestrator + ShopWorks push (cluster #6, 2026-07-07)
 *   quote-lifecycle.js — resetQuote/discounts/fees panel/tracking (cluster #7, 2026-07-07)
 *   pricing-sync.js  — recalculatePricing + display + tax/ship UI (cluster #8, 2026-07-07)
 *   logo-config.js   — stitch/logo/embellishment UI + AL state sync (cluster #9, 2026-07-07)
 *   product-rows.js  — search/rows/sizes/colors machinery (cluster #10, 2026-07-07)
 */
import { loadServiceCodePrices, getServicePrice } from './pricing.js';
import {
    showServicePricingReview,
    onSprProductSourceChange,
    onSprCustomProductFocus,
    onSprSourceChange,
    onSprCustomServiceFocus,
    onSprGarmentPositionChange,
    onSprGarmentStitchTierChange,
    onSprCapEmbellishmentChange,
    onSprStitchChange,
    cancelServicePricingReview,
    applyServicePricingReview,
    getSprEmbConfigOptions,
} from './spr-modal.js';
import {
    openShopWorksImportModal,
    closeShopWorksImportModal,
    showAddNonSanmarModal,
    closeAddNonSanmarModal,
    toggleNsMoreOptions,
    validateNsModalFields,
    saveNonSanmarProduct,
    parseAndPreviewShopWorks,
    confirmShopWorksImport,
    dismissImportBanner,
    scrollToProductRow,
} from './shopworks-import.js';
import {
    initEmbroideryPersistence,
    getEmbroideryQuoteData,
    restoreEmbroideryDraft,
    markEmbroideryDirty,
    loadQuoteForEditing,
    duplicateQuote,
    addProductFromQuote,
    populateLogoConfig,
} from './persistence.js';
import {
    diagnoseQuote,
    buildEmbroideryPricingData,
    copyToClipboard,
    generateEmbQuoteText,
    printQuote,
    embEmailQuote,
} from './output.js';
import {
    saveAndGetLink,
    saveQuote,
    updatePushButtonState,
    getPushReadiness,
    renderPushReadiness,
    showPushButton,
    pushToShopWorks,
    openPushPreview,
    confirmPushToShopWorks,
    verifyShopWorksImport,
    closePushPreview,
} from './save-push.js';
import {
    toggleAdditionalCharges,
    toggleOrderDetails,
    setupUnsavedChangesTracking,
    clearCustomerContextBanners,
    resetQuote,
    updateDiscountType,
    handleDiscountPresetChange,
    handleDiscountReasonPresetChange,
    onLtmOverrideChange,
    updateAdditionalCharges,
    updateFeeTableRows,
    getAdditionalCharges,
    collectDECGItems,
} from './quote-lifecycle.js';
import {
    recalculatePricing,
    debouncedRecalculatePricing,
    debounce,
    collectProductsFromTable,
    updatePricingDisplay,
    calculateDiscountableSubtotal,
    buildLogoConfiguration,
    getOrderPieceCounts,
    syncALRows,
    syncDECGRows,
    _syncDecgLtmRow,
    syncRushRow,
    getRushRate,
    estimateShipping,
    syncDigitizingPriceLabels,
    updateDigitizingNudges,
    retryRowPricing,
    toggleWholesale,
    lookupTaxRate,
    updateTaxCalculation,
    onShipStateChange,
    onShipZipBlur,
    onShipMethodChange,
    setShipMode,
    updateShippingSummary,
    openShippingModal,
    closeShippingModal,
} from './pricing-sync.js';
import {
    _syncALArrays,
    mapStitchCountToTierValue,
    initStitchEstimators,
    openStitchEstimator,
    onPrimaryPositionChange,
    onPrimaryStitchTierChange,
    onFullBackStitchCountChange,
    onCapStitchTierChange,
    updateStitchTierDropdownLabels,
    updateGlobalAL,
    toggleGlobalALNew,
    toggleLogoCard,
    toggleNotesSection,
    updateNotesBadge,
    toggleDigitizingCheckbox,
    handleCapEmbellishmentChange,
    getCapEmbellishmentType,
    updateEmbellishmentDropdownLabels,
} from './logo-config.js';
import {
    updateLogoCardHeader,
    dateToInputValue,
    dateFromInputValue,
    setupPrimaryLogoHandlers,
    setupCapPrimaryLogoHandlers,
    updateCapLogoSectionVisibility,
    updateGarmentLogoSectionVisibility,
    updateArtworkServicesVisibility,
    setupSearchAutocomplete,
    selectProduct,
    addNewRow,
    addProductRow,
    addNonSanmarFromSearch,
    createServiceProductRow,
    addManualServiceRow,
    addALLineItem,
    addDECGLineItem,
    addExtraColorSurchargeRow,
    openMonogramNamesDialog,
    onServiceQtyChange,
    deleteServiceRow,
    onStyleChange,
    populateNonSanmarRow,
    updateNonSanmarPriceCell,
    selectNonSanmarColor,
    parseShopWorksDescription,
    isCapProduct,
    detectAndAdjustSizeUI,
    toggleColorPicker,
    selectColor,
    handleColorPickerKeydown,
    selectChildColor,
    onSizeChange,
    hideVariantOnlyParents,
    createChildRow,
    removeChildRow,
    onChildSizeChange,
    clearExtendedSize,
    deleteRow,
    duplicateRowNewColor,
    enablePriceOverride,
    clearPriceOverride,
    handleCellKeydown,
    updateRowBreakdown,
    buildPricingBreakdown,
} from './product-rows.js';
import {
    applyDesignFromCache,
    filterDesignSearchByTier,
    filterDesignSearchByCompany,
    lookupDesignNumber,
    showDesignThumbnail,
    openThumbnailFullSize,
    clearDesignNumber,
    openDesignSearchModal,
    closeDesignSearchModal,
    onDesignSearchInput,
    runDesignSearch,
    selectDesignFromSearch,
    showMoreDesignSearchResults,
    invalidateDesignGalleryCache,
    resetDesignSearchState,
} from './design-search.js';

// Strangler bridges — bare-identifier callers in the monolith resolve
// through the global object, so these keep every existing call site,
// static inline handler, and GENERATED-markup handler working. Drop each
// line only when its callers migrate.
window.loadServiceCodePrices = loadServiceCodePrices;
window.getServicePrice = getServicePrice;

// design-search (callers: monolith draft-restore/import + static HTML
// handlers + onclick= handlers the module renders into the grid/chips)
window.applyDesignFromCache = applyDesignFromCache;
window.filterDesignSearchByTier = filterDesignSearchByTier;
window.filterDesignSearchByCompany = filterDesignSearchByCompany;
window.lookupDesignNumber = lookupDesignNumber;
window.showDesignThumbnail = showDesignThumbnail;
window.openThumbnailFullSize = openThumbnailFullSize;
window.clearDesignNumber = clearDesignNumber;
window.openDesignSearchModal = openDesignSearchModal;
window.closeDesignSearchModal = closeDesignSearchModal;
window.onDesignSearchInput = onDesignSearchInput;
window.runDesignSearch = runDesignSearch;
window.selectDesignFromSearch = selectDesignFromSearch;
window.showMoreDesignSearchResults = showMoreDesignSearchResults;
window.invalidateDesignGalleryCache = invalidateDesignGalleryCache;
window.resetDesignSearchState = resetDesignSearchState;

// spr-modal (callers: the monolith import flow awaits showServicePricingReview;
// static HTML handlers + onchange/onfocus/oninput handlers the modal renders
// into its product/service tables; import cluster reads getSprEmbConfigOptions)
window.showServicePricingReview = showServicePricingReview;
window.onSprProductSourceChange = onSprProductSourceChange;
window.onSprCustomProductFocus = onSprCustomProductFocus;
window.onSprSourceChange = onSprSourceChange;
window.onSprCustomServiceFocus = onSprCustomServiceFocus;
window.onSprGarmentPositionChange = onSprGarmentPositionChange;
window.onSprGarmentStitchTierChange = onSprGarmentStitchTierChange;
window.onSprCapEmbellishmentChange = onSprCapEmbellishmentChange;
window.onSprStitchChange = onSprStitchChange;
window.cancelServicePricingReview = cancelServicePricingReview;
window.applyServicePricingReview = applyServicePricingReview;
window.getSprEmbConfigOptions = getSprEmbConfigOptions;

// shopworks-import (callers: static HTML modal handlers, generated banner
// markup, and the search cluster's add-non-SanMar entry point)
window.openShopWorksImportModal = openShopWorksImportModal;
window.closeShopWorksImportModal = closeShopWorksImportModal;
window.showAddNonSanmarModal = showAddNonSanmarModal;
window.closeAddNonSanmarModal = closeAddNonSanmarModal;
window.toggleNsMoreOptions = toggleNsMoreOptions;
window.validateNsModalFields = validateNsModalFields;
window.saveNonSanmarProduct = saveNonSanmarProduct;
window.parseAndPreviewShopWorks = parseAndPreviewShopWorks;
window.confirmShopWorksImport = confirmShopWorksImport;
window.dismissImportBanner = dismissImportBanner;
window.scrollToProductRow = scrollToProductRow;

// persistence (callers: the DOMContentLoaded init in the monolith — autosave
// wiring, draft restore, ?edit=/?duplicate= flows — plus dirty-marking from
// change tracking and QQ-handoff/import product adds)
window.initEmbroideryPersistence = initEmbroideryPersistence;
window.getEmbroideryQuoteData = getEmbroideryQuoteData;
window.restoreEmbroideryDraft = restoreEmbroideryDraft;
window.markEmbroideryDirty = markEmbroideryDirty;
window.loadQuoteForEditing = loadQuoteForEditing;
window.duplicateQuote = duplicateQuote;
window.addProductFromQuote = addProductFromQuote;
window.populateLogoConfig = populateLogoConfig; // consumer: emb-edit-reload-roundtrip harness

// output (callers: static HTML print/email/copy buttons; diagnoseQuote from
// the import flow's diagnostics hook; the rest internal)
window.diagnoseQuote = diagnoseQuote;
window.buildEmbroideryPricingData = buildEmbroideryPricingData;
window.copyToClipboard = copyToClipboard;
window.generateEmbQuoteText = generateEmbQuoteText;
window.printQuote = printQuote;
window.embEmailQuote = embEmailQuote;

// save-push (callers: static HTML save/push buttons; utils + share-modal +
// pricing sync call saveAndGetLink/updatePushButtonState via window)
window.saveAndGetLink = saveAndGetLink;
window.saveQuote = saveQuote;
window.updatePushButtonState = updatePushButtonState;
window.getPushReadiness = getPushReadiness;
window.renderPushReadiness = renderPushReadiness;
window.showPushButton = showPushButton;
window.pushToShopWorks = pushToShopWorks;
window.openPushPreview = openPushPreview;
window.confirmPushToShopWorks = confirmPushToShopWorks;
window.verifyShopWorksImport = verifyShopWorksImport;
window.closePushPreview = closePushPreview;

// quote-lifecycle (callers: static HTML fee/discount/panel handlers, utils'
// confirmNewQuote → resetQuote, extended-sizes/pricing sync → fee table,
// monolith init → tracking setup)
window.toggleAdditionalCharges = toggleAdditionalCharges;
window.toggleOrderDetails = toggleOrderDetails;
window.setupUnsavedChangesTracking = setupUnsavedChangesTracking;
window.clearCustomerContextBanners = clearCustomerContextBanners;
window.resetQuote = resetQuote;
window.updateDiscountType = updateDiscountType;
window.handleDiscountPresetChange = handleDiscountPresetChange;
window.handleDiscountReasonPresetChange = handleDiscountReasonPresetChange;
window.onLtmOverrideChange = onLtmOverrideChange;
window.updateAdditionalCharges = updateAdditionalCharges;
window.updateFeeTableRows = updateFeeTableRows;
window.getAdditionalCharges = getAdditionalCharges;
window.collectDECGItems = collectDECGItems;

// pricing-sync (callers: the monolith's row/size/logo handlers funnel into
// recalculatePricing — 40 call sites — plus static HTML tax/ship handlers
// and generated retry markup). recalculatePricing arrives pre-wrapped with
// the reprice pill (live export let; module tail rewraps before this runs).
window.recalculatePricing = recalculatePricing;
window.debouncedRecalculatePricing = debouncedRecalculatePricing;
window.debounce = debounce;
window.collectProductsFromTable = collectProductsFromTable;
window.updatePricingDisplay = updatePricingDisplay;
window.calculateDiscountableSubtotal = calculateDiscountableSubtotal;
window.buildLogoConfiguration = buildLogoConfiguration;
window.getOrderPieceCounts = getOrderPieceCounts;
window.syncALRows = syncALRows;
window.syncDECGRows = syncDECGRows;
window._syncDecgLtmRow = _syncDecgLtmRow;
window.syncRushRow = syncRushRow;
window.getRushRate = getRushRate;
window.estimateShipping = estimateShipping;
window.syncDigitizingPriceLabels = syncDigitizingPriceLabels;
window.updateDigitizingNudges = updateDigitizingNudges;
window.retryRowPricing = retryRowPricing;
window.toggleWholesale = toggleWholesale;
window.lookupTaxRate = lookupTaxRate;
window.updateTaxCalculation = updateTaxCalculation;
window.onShipStateChange = onShipStateChange;
window.onShipZipBlur = onShipZipBlur;
window.onShipMethodChange = onShipMethodChange;
window.setShipMode = setShipMode;
window.updateShippingSummary = updateShippingSummary;
window.openShippingModal = openShippingModal;
window.closeShippingModal = closeShippingModal;

// logo-config (callers: static HTML logo-card/stitch/AL/embellishment
// handlers + monolith init wiring + notes badge updates)
window._syncALArrays = _syncALArrays;
window.mapStitchCountToTierValue = mapStitchCountToTierValue;
window.initStitchEstimators = initStitchEstimators;
window.openStitchEstimator = openStitchEstimator;
window.onPrimaryPositionChange = onPrimaryPositionChange;
window.onPrimaryStitchTierChange = onPrimaryStitchTierChange;
window.onFullBackStitchCountChange = onFullBackStitchCountChange;
window.onCapStitchTierChange = onCapStitchTierChange;
window.updateStitchTierDropdownLabels = updateStitchTierDropdownLabels;
window.updateGlobalAL = updateGlobalAL;
window.toggleGlobalALNew = toggleGlobalALNew;
window.toggleLogoCard = toggleLogoCard;
window.toggleNotesSection = toggleNotesSection;
window.updateNotesBadge = updateNotesBadge;
window.toggleDigitizingCheckbox = toggleDigitizingCheckbox;
window.handleCapEmbellishmentChange = handleCapEmbellishmentChange;
window.getCapEmbellishmentType = getCapEmbellishmentType;
window.updateEmbellishmentDropdownLabels = updateEmbellishmentDropdownLabels;

// product-rows (callers: static HTML search/row/color handlers, the size
// grid + color picker + child-row GENERATED markup, and the monolith's
// composition root wiring)
window.updateLogoCardHeader = updateLogoCardHeader;
window.dateToInputValue = dateToInputValue;
window.dateFromInputValue = dateFromInputValue;
window.setupPrimaryLogoHandlers = setupPrimaryLogoHandlers;
window.setupCapPrimaryLogoHandlers = setupCapPrimaryLogoHandlers;
window.updateCapLogoSectionVisibility = updateCapLogoSectionVisibility;
window.updateGarmentLogoSectionVisibility = updateGarmentLogoSectionVisibility;
window.updateArtworkServicesVisibility = updateArtworkServicesVisibility;
window.setupSearchAutocomplete = setupSearchAutocomplete;
window.selectProduct = selectProduct;
window.addNewRow = addNewRow;
window.addProductRow = addProductRow;
window.addNonSanmarFromSearch = addNonSanmarFromSearch;
window.createServiceProductRow = createServiceProductRow;
window.addManualServiceRow = addManualServiceRow;
window.addALLineItem = addALLineItem;
window.addDECGLineItem = addDECGLineItem;
window.addExtraColorSurchargeRow = addExtraColorSurchargeRow;
window.openMonogramNamesDialog = openMonogramNamesDialog;
window.onServiceQtyChange = onServiceQtyChange;
window.deleteServiceRow = deleteServiceRow;
window.onStyleChange = onStyleChange;
window.populateNonSanmarRow = populateNonSanmarRow;
window.updateNonSanmarPriceCell = updateNonSanmarPriceCell;
window.selectNonSanmarColor = selectNonSanmarColor;
window.parseShopWorksDescription = parseShopWorksDescription;
window.isCapProduct = isCapProduct;
window.detectAndAdjustSizeUI = detectAndAdjustSizeUI;
window.toggleColorPicker = toggleColorPicker;
window.selectColor = selectColor;
window.handleColorPickerKeydown = handleColorPickerKeydown;
window.selectChildColor = selectChildColor;
window.onSizeChange = onSizeChange;
window.hideVariantOnlyParents = hideVariantOnlyParents;
window.createChildRow = createChildRow;
window.removeChildRow = removeChildRow;
window.onChildSizeChange = onChildSizeChange;
window.clearExtendedSize = clearExtendedSize;
window.deleteRow = deleteRow;
window.duplicateRowNewColor = duplicateRowNewColor;
window.enablePriceOverride = enablePriceOverride;
window.clearPriceOverride = clearPriceOverride;
window.handleCellKeydown = handleCellKeydown;
window.updateRowBreakdown = updateRowBreakdown;
window.buildPricingBreakdown = buildPricingBreakdown;

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.emb = { entry: 'builders/emb/index.js', modules: ['pricing', 'design-search', 'spr-modal', 'shopworks-import', 'persistence', 'output', 'save-push', 'quote-lifecycle', 'pricing-sync', 'logo-config', 'product-rows'] };
