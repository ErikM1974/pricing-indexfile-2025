/**
 * Window extensions the quote-builder pages rely on (roadmap 0.6).
 * Keep loose (`any`-ish) while the strangler migration is in flight;
 * tighten as modules land in shared_components/js/builders/**.
 */

interface TenantConfig {
    id: string;
    branding: {
        name: string;
        phone: string;
        phoneDisplay?: string;
        email: string;
        website?: string;
        logoUrl: string;
        founded?: number;
        address: { street: string; city: string; state: string; zip: string };
        palette: Record<string, string>;
    };
    api: { baseUrl: string };
    email: {
        provider: string;
        publicKey: string;
        serviceId: string;
        templates: Record<string, string>;
    };
    tax: { mode: string; defaultRateDisplay: number };
    methods: Record<string, boolean>;
    currency: { code: string; symbol: string; decimals: number };
    units: string;
    features: Record<string, unknown>;
    ready?: Promise<string>;
}

interface Window {
    TENANT?: TenantConfig;
    APP_CONFIG?: any;
    __QB_BUILD?: Record<string, { entry: string; modules?: string[]; stage?: string }>;
    /** Service_Codes cache (builders/emb/pricing.js) — legacy cross-file contract. */
    _serviceCodes?: Record<string, any> | null;
    /** window-backed EMB contract fields (state.js): classic multi-builder consumers. */
    childRowMap?: Record<string, Record<string, any>>;
    hasChanges?: boolean;
    pricingCalculator?: any;
    /** builders/emb state handles (state.js via index.js). */
    __embState?: any;
    __quoteState?: any;
    __scpState?: any;
    __scpQuoteState?: any;
    /** builders/emb debug handle for the active method adapter. */
    __embAdapter?: any;
    /** quote-builder-utils.js loading overlay (classic function declaration → window prop). */
    showLoading?: (show: boolean, message?: string) => void;
    /** quote-builder-utils.js toast (classic function declaration → window prop). */
    showToast?: (msg: string, type?: string, duration?: number) => void;
    loadServiceCodePrices?: () => Promise<Record<string, any> | null>;
    getServicePrice?: (code: string, fallback: number) => number;
    /* design-search bridges (builders/emb/design-search.js, extraction #1) */
    applyDesignFromCache?: (type: string, designData: any) => Promise<void> | void;
    filterDesignSearchByTier?: (tier: string) => void;
    filterDesignSearchByCompany?: (company: string) => void;
    lookupDesignNumber?: (type: string) => Promise<void>;
    showDesignThumbnail?: (type: string, url: string | null) => void;
    openThumbnailFullSize?: (imgEl: any) => void;
    clearDesignNumber?: (type: string) => void;
    openDesignSearchModal?: (type: string) => void;
    closeDesignSearchModal?: () => void;
    onDesignSearchInput?: (ev?: any) => void;
    runDesignSearch?: () => Promise<void>;
    selectDesignFromSearch?: (designNumber: string) => Promise<void> | void;
    showMoreDesignSearchResults?: () => void;
    invalidateDesignGalleryCache?: () => void;
    resetDesignSearchState?: () => void;
    /* spr-modal bridges (builders/emb/spr-modal.js, extraction #2) */
    showServicePricingReview?: (serviceItems: any[], productItems: any[], embConfigOptions?: any) => Promise<any>;
    onSprProductSourceChange?: (pIdx: number) => void;
    onSprCustomProductFocus?: (pIdx: number) => void;
    onSprSourceChange?: (idx: number) => void;
    onSprCustomServiceFocus?: (idx: number) => void;
    onSprGarmentPositionChange?: () => void;
    onSprGarmentStitchTierChange?: () => void;
    onSprCapEmbellishmentChange?: () => void;
    onSprStitchChange?: (idx: number) => void;
    cancelServicePricingReview?: () => void;
    applyServicePricingReview?: () => void;
    getSprEmbConfigOptions?: () => any;
    /* shopworks-import bridges (builders/emb/shopworks-import.js, extraction #3) */
    openShopWorksImportModal?: () => void;
    closeShopWorksImportModal?: () => void;
    showAddNonSanmarModal?: (opts?: any) => void;
    closeAddNonSanmarModal?: () => void;
    toggleNsMoreOptions?: () => void;
    validateNsModalFields?: () => void;
    saveNonSanmarProduct?: () => Promise<void>;
    parseAndPreviewShopWorks?: () => Promise<void> | void;
    confirmShopWorksImport?: () => Promise<void>;
    dismissImportBanner?: () => void;
    scrollToProductRow?: (rowId: number | string) => void;
    /* persistence bridges (builders/emb/persistence.js, extraction #4) */
    initEmbroideryPersistence?: () => void;
    getEmbroideryQuoteData?: () => any;
    restoreEmbroideryDraft?: (draft: any) => Promise<void> | void;
    markEmbroideryDirty?: () => void;
    loadQuoteForEditing?: (quoteId: string, revision?: any) => Promise<any>;
    duplicateQuote?: (quoteId: string) => Promise<void>;
    addProductFromQuote?: (item: any, opts?: any) => Promise<void>;
    populateLogoConfig?: (session: any) => void;
    /* output bridges (builders/emb/output.js, extraction #5) */
    diagnoseQuote?: () => any;
    buildEmbroideryPricingData?: () => any;
    copyToClipboard?: () => Promise<void> | void;
    generateEmbQuoteText?: () => string;
    printQuote?: () => Promise<void> | void;
    embEmailQuote?: () => Promise<void>;
    /* save-push bridges (builders/emb/save-push.js, extraction #6) */
    saveAndGetLink?: (opts?: any) => Promise<any>;
    saveQuote?: () => Promise<void>;
    updatePushButtonState?: () => void;
    getPushReadiness?: () => any;
    renderPushReadiness?: () => void;
    showPushButton?: () => void;
    pushToShopWorks?: () => Promise<void>;
    openPushPreview?: () => Promise<void>;
    confirmPushToShopWorks?: () => Promise<void>;
    verifyShopWorksImport?: () => Promise<void>;
    closePushPreview?: () => void;
    /* quote-lifecycle bridges (builders/emb/quote-lifecycle.js, extraction #7) */
    toggleAdditionalCharges?: () => void;
    toggleOrderDetails?: () => void;
    setupUnsavedChangesTracking?: () => void;
    clearCustomerContextBanners?: () => void;
    resetQuote?: (opts?: any) => void;
    updateDiscountType?: () => void;
    handleDiscountPresetChange?: () => void;
    handleDiscountReasonPresetChange?: () => void;
    onLtmOverrideChange?: () => void;
    updateAdditionalCharges?: () => void;
    updateFeeTableRows?: () => void;
    getAdditionalCharges?: () => any;
    collectDECGItems?: () => any[];
    /* pricing-sync bridges (builders/emb/pricing-sync.js, extraction #8) */
    recalculatePricing?: () => Promise<void>;
    debouncedRecalculatePricing?: () => void;
    debounce?: (fn: any, ms: number) => any;
    collectProductsFromTable?: () => any[];
    updatePricingDisplay?: (data?: any) => void;
    calculateDiscountableSubtotal?: () => any;
    buildLogoConfiguration?: () => any;
    getOrderPieceCounts?: () => any;
    syncALRows?: () => Promise<void>;
    syncDECGRows?: () => Promise<void>;
    _syncDecgLtmRow?: (state?: any) => void;
    syncRushRow?: () => void;
    getRushRate?: () => number;
    estimateShipping?: () => Promise<void>;
    syncDigitizingPriceLabels?: () => void;
    updateDigitizingNudges?: () => void;
    retryRowPricing?: (rowId: any) => Promise<void>;
    toggleWholesale?: () => void;
    lookupTaxRate?: () => Promise<boolean> | Promise<void>;
    updateTaxCalculation?: () => void;
    onShipStateChange?: () => void;
    onShipZipBlur?: () => void;
    onShipMethodChange?: () => void;
    setShipMode?: (mode: string) => void;
    updateShippingSummary?: () => void;
    openShippingModal?: () => void;
    closeShippingModal?: () => void;
    /* logo-config bridges (builders/emb/logo-config.js, extraction #9) */
    _syncALArrays?: () => void;
    mapStitchCountToTierValue?: (sc: number) => string;
    initStitchEstimators?: () => void;
    openStitchEstimator?: (type: string) => void;
    onPrimaryPositionChange?: () => void;
    onPrimaryStitchTierChange?: () => void;
    onFullBackStitchCountChange?: () => void;
    onCapStitchTierChange?: () => void;
    updateStitchTierDropdownLabels?: () => void;
    updateGlobalAL?: (type: string) => void;
    toggleGlobalALNew?: (type: string) => void;
    toggleLogoCard?: (type: string) => void;
    toggleNotesSection?: () => void;
    updateNotesBadge?: () => void;
    toggleDigitizingCheckbox?: (type: string) => void;
    handleCapEmbellishmentChange?: () => void;
    getCapEmbellishmentType?: () => string;
    updateEmbellishmentDropdownLabels?: () => void;
    /* product-rows bridges (builders/emb/product-rows.js, extraction #10) */
    updateLogoCardHeader?: (...args: any[]) => any;
    dateToInputValue?: (...args: any[]) => any;
    dateFromInputValue?: (...args: any[]) => any;
    setupPrimaryLogoHandlers?: (...args: any[]) => any;
    setupCapPrimaryLogoHandlers?: (...args: any[]) => any;
    updateCapLogoSectionVisibility?: (...args: any[]) => any;
    updateGarmentLogoSectionVisibility?: (...args: any[]) => any;
    updateArtworkServicesVisibility?: (...args: any[]) => any;
    setupSearchAutocomplete?: (...args: any[]) => any;
    selectProduct?: (...args: any[]) => any;
    addNewRow?: (...args: any[]) => any;
    addProductRow?: (...args: any[]) => any;
    addNonSanmarFromSearch?: (...args: any[]) => any;
    createServiceProductRow?: (...args: any[]) => any;
    addManualServiceRow?: (...args: any[]) => any;
    addALLineItem?: (...args: any[]) => any;
    addDECGLineItem?: (...args: any[]) => any;
    addExtraColorSurchargeRow?: (...args: any[]) => any;
    openMonogramNamesDialog?: (...args: any[]) => any;
    onServiceQtyChange?: (...args: any[]) => any;
    deleteServiceRow?: (...args: any[]) => any;
    onStyleChange?: (...args: any[]) => any;
    populateNonSanmarRow?: (...args: any[]) => any;
    updateNonSanmarPriceCell?: (...args: any[]) => any;
    selectNonSanmarColor?: (...args: any[]) => any;
    parseShopWorksDescription?: (...args: any[]) => any;
    isCapProduct?: (...args: any[]) => any;
    detectAndAdjustSizeUI?: (...args: any[]) => any;
    toggleColorPicker?: (...args: any[]) => any;
    selectColor?: (...args: any[]) => any;
    handleColorPickerKeydown?: (...args: any[]) => any;
    selectChildColor?: (...args: any[]) => any;
    onSizeChange?: (...args: any[]) => any;
    hideVariantOnlyParents?: (...args: any[]) => any;
    createChildRow?: (...args: any[]) => any;
    removeChildRow?: (...args: any[]) => any;
    onChildSizeChange?: (...args: any[]) => any;
    clearExtendedSize?: (...args: any[]) => any;
    deleteRow?: (...args: any[]) => any;
    duplicateRowNewColor?: (...args: any[]) => any;
    enablePriceOverride?: (...args: any[]) => any;
    clearPriceOverride?: (...args: any[]) => any;
    handleCellKeydown?: (...args: any[]) => any;
    updateRowBreakdown?: (...args: any[]) => any;
    buildPricingBreakdown?: (...args: any[]) => any;
    /* SCP bridges (builders/scp/*, S1a + S1b) — names shared with EMB are typed above */
    recalculateAllPrices?: (...args: any[]) => any;
    getScpExtraFees?: (...args: any[]) => any;
    applyRushPercent?: (...args: any[]) => any;
    spcEmailQuote?: (...args: any[]) => any;
    scpPushToShopWorks?: (...args: any[]) => any;
    openScpPushPreview?: (...args: any[]) => any;
    renderScpPushPreview?: (...args: any[]) => any;
    confirmScpPush?: (...args: any[]) => any;
    closeScpPushPreview?: (...args: any[]) => any;
    showScpPushButton?: (...args: any[]) => any;
    updateScpPushButtonState?: (...args: any[]) => any;
    updatePrintConfig?: (...args: any[]) => any;
    updateDarkGarmentNudge?: (...args: any[]) => any;
    initScreenPrintPersistence?: (...args: any[]) => any;
    restoreScreenPrintDraft?: (...args: any[]) => any;
    markScreenPrintDirty?: (...args: any[]) => any;
    applyMethodSwitchPrefillScp?: (...args: any[]) => any;
    applyQuickQuotePrefillScp?: (...args: any[]) => any;
    skuValidationService?: any;
    _isWholesale?: boolean;
    _taxExempt?: boolean;
    _lastShipEstimate?: any;
}

/*
 * Monolith lexical globals the extracted modules still reach through the
 * global scope chain (strangler seams — each migrates with its own cluster).
 */
declare function escapeHtml(s: any): string;
declare function showToast(msg: string, type?: string, duration?: number): void;
declare let DesignThumbnailService: any;
declare function renderOrderRecap(): void;
