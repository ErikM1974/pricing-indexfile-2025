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
}
