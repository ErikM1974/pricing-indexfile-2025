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
    __QB_BUILD?: Record<string, { entry: string; modules?: string[] }>;
    /** Service_Codes cache (builders/emb/pricing.js) — legacy cross-file contract. */
    _serviceCodes?: Record<string, any> | null;
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
    loadQuoteForEditing?: (quoteId: string, revision?: any) => Promise<void>;
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
}

/*
 * Monolith lexical globals the extracted modules still reach through the
 * global scope chain (strangler seams — each migrates with its own cluster).
 */
declare let primaryLogo: any;
declare let capPrimaryLogo: any;
declare function onPrimaryPositionChange(): void;
declare function onPrimaryStitchTierChange(): void;
declare function onCapStitchTierChange(): void;
declare function updateLogoCardHeader(type: string): void;
declare function lookupTaxRate(): Promise<void> | void;
declare function updatePushButtonState(): void;
declare function escapeHtml(s: any): string;
declare function showToast(msg: string, type?: string, duration?: number): void;
declare let DesignThumbnailService: any;
declare function renderOrderRecap(): void;
declare function mapStitchCountToTierValue(stitchCount: number): string;
declare let pricingCalculator: any;
