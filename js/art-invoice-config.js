/* Art Invoice Configuration - Business Constants
   ============================================
   This file contains all business constants and configuration values
   for the Art Invoice system. Centralizing these values makes them
   easier to maintain and update.
   
   Created: 2025-07-03
   ============================================ */

// Art Invoice Configuration Object
const ART_INVOICE_CONFIG = {
    // Service Code Options
    SERVICE_CODES: {
        // Main service codes with rates
        'GRT-25': { rate: 25, description: 'Basic Art Services (15 min @ $100/hr)' },
        'GRT-50': { rate: 50, description: 'Standard Art Services (30 min @ $100/hr)' },
        'GRT-75': { rate: 75, description: 'Complex Art Services (45 min @ $100/hr)' },
        'GRT-100': { rate: 100, description: 'Advanced Art Services (60 min @ $100/hr)' },
        'GRT-125': { rate: 125, description: 'Premium Art Services (75 min @ $100/hr)' },
        'GRT-150': { rate: 150, description: 'Elite Art Services (90 min @ $100/hr)' },
        'GRT-175': { rate: 175, description: 'Master Art Services (105 min @ $100/hr)' },
        'GRT-200': { rate: 200, description: 'Executive Art Services (120 min @ $100/hr)' },
        'GRT-0': { rate: 0, description: 'Complimentary Art Services' }
    },

    // Hourly Rate
    HOURLY_RATE: 100,

    // Project Types
    PROJECT_TYPES: [
        'Design',
        'Redesign', 
        'Revision',
        'Vector Conversion',
        'Logo Creation',
        'Custom Artwork',
        'Layout',
        'Mockup'
    ],

    // Complexity Levels
    COMPLEXITY_LEVELS: [
        'Simple',
        'Standard',
        'Complex',
        'Very Complex'
    ],

    // Invoice Status Options
    INVOICE_STATUSES: {
        DRAFT: 'Draft',
        SENT: 'Sent',
        PAID: 'Paid',
        PARTIALLY_PAID: 'Partially Paid',
        OVERDUE: 'Overdue',
        VOIDED: 'Voided',
        CANCELLED: 'Cancelled'
    },

    // Payment Methods
    PAYMENT_METHODS: [
        'Credit Card',
        'Check',
        'Cash',
        'ACH Transfer',
        'Wire Transfer',
        'PayPal',
        'Store Credit',
        'Other'
    ],

    // Default Values
    DEFAULTS: {
        DUE_DAYS: 0, // COD - Payment due immediately via Credit Card
        PAYMENT_TERMS: 'COD - Payment Via Credit Card',
        TAX_RATE: 0.10, // 10% WA state tax
        RUSH_FEE_PERCENTAGE: 0.50, // 50% rush fee
        LATE_FEE_PERCENTAGE: 0.015, // 1.5% per month
        INVOICE_PREFIX: 'ART-',
        DATE_FORMAT: 'MM/DD/YYYY'
    },

    // Email Configuration
    EMAIL: {
        SERVICE_ID: 'service_1c4k67j',
        TEMPLATE_ID: 'ArtInvoice',
        PUBLIC_KEY: '4qSbDO-SQs19TbP80',
        FROM_NAME: 'Northwest Custom Apparel Art Department',
        DEFAULT_REPLY_TO: 'art@nwcustomapparel.com'
    },

    // Company Information
    COMPANY: {
        NAME: 'Northwest Custom Apparel',
        PHONE: '253-922-5793',
        EMAIL: 'sales@nwcustomapparel.com',
        WEBSITE: 'www.nwcustomapparel.com',
        ADDRESS: '2025 Freeman Road East, Milton, WA 98354',
        ESTABLISHED: '1977',
        TAGLINE: 'Family Owned & Operated Since 1977'
    },

    // API Configuration
    API: {
        BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        ENDPOINTS: {
            ART_REQUESTS: '/artrequests',
            ART_INVOICES: '/art-invoices'
        },
        TIMEOUT: 30000, // 30 seconds
        RETRY_ATTEMPTS: 3
    },

    // UI Configuration
    UI: {
        RESULTS_PER_PAGE: 10,
        DATE_PICKER_FORMAT: 'YYYY-MM-DD',
        CURRENCY_FORMAT: {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        },
        LOADING_MESSAGES: {
            SEARCH: 'Searching art requests...',
            CREATE: 'Creating invoice...',
            UPDATE: 'Updating invoice...',
            SEND: 'Sending invoice...',
            VOID: 'Voiding invoice...'
        }
    },

    // Validation Rules
    VALIDATION: {
        MIN_INVOICE_AMOUNT: 0,
        MAX_INVOICE_AMOUNT: 99999.99,
        MAX_DESCRIPTION_LENGTH: 500,
        MAX_NOTES_LENGTH: 1000,
        INVOICE_ID_PATTERN: /^ART-\d+$/,
        EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },

    // Feature Flags
    FEATURES: {
        ENABLE_SPEC_ARTWORK: true,
        ENABLE_RUSH_FEES: true,
        ENABLE_REVISION_FEES: true,
        ENABLE_TAX_CALCULATION: true,
        ENABLE_PAYMENT_TRACKING: true,
        ENABLE_EMAIL_NOTIFICATIONS: true,
        ENABLE_VOID_FUNCTIONALITY: true,
        ENABLE_EDIT_MODE: true
    },

    // Time Intervals (in minutes)
    TIME_INTERVALS: [
        { value: 15, label: '15 minutes' },
        { value: 30, label: '30 minutes' },
        { value: 45, label: '45 minutes' },
        { value: 60, label: '1 hour' },
        { value: 75, label: '1 hour 15 minutes' },
        { value: 90, label: '1 hour 30 minutes' },
        { value: 105, label: '1 hour 45 minutes' },
        { value: 120, label: '2 hours' },
        { value: 150, label: '2 hours 30 minutes' },
        { value: 180, label: '3 hours' },
        { value: 240, label: '4 hours' },
        { value: 300, label: '5 hours' },
        { value: 360, label: '6 hours' },
        { value: 420, label: '7 hours' },
        { value: 480, label: '8 hours' }
    ],

    // Spec Art Purpose Options
    SPEC_ART_PURPOSES: [
        'Sales support',
        'Customer presentation',
        'Internal review',
        'Marketing materials',
        'Trade show display',
        'Website content',
        'Social media',
        'Other'
    ]
};

// Helper function to get service code description with rate
function getServiceCodeInfo(code) {
    const codeInfo = ART_INVOICE_CONFIG.SERVICE_CODES[code];
    if (!codeInfo) return null;
    
    return {
        code: code,
        rate: codeInfo.rate,
        description: codeInfo.description,
        displayText: `${code} - $${codeInfo.rate} - ${codeInfo.description}`
    };
}

// Helper function to calculate time from service code
function getTimeFromServiceCode(code) {
    const codeInfo = ART_INVOICE_CONFIG.SERVICE_CODES[code];
    if (!codeInfo) return 0;
    
    // Extract time in minutes from rate (assuming $100/hr)
    return (codeInfo.rate / ART_INVOICE_CONFIG.HOURLY_RATE) * 60;
}

// Helper function to suggest service code from time
function suggestServiceCode(minutes) {
    const rate = (minutes / 60) * ART_INVOICE_CONFIG.HOURLY_RATE;
    
    // Find the closest service code
    let closestCode = 'GRT-25';
    let closestDiff = Math.abs(25 - rate);
    
    for (const [code, info] of Object.entries(ART_INVOICE_CONFIG.SERVICE_CODES)) {
        if (code === 'GRT-0') continue; // Skip complimentary code
        
        const diff = Math.abs(info.rate - rate);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestCode = code;
        }
    }
    
    return closestCode;
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', ART_INVOICE_CONFIG.UI.CURRENCY_FORMAT).format(amount);
}

// Helper function to format date
function formatDateConfig(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${month}/${day}/${year}`;
}

// Helper function to calculate due date
function calculateDueDate(invoiceDate) {
    const date = new Date(invoiceDate);
    // For COD/Credit Card payments, due date is same as invoice date
    if (ART_INVOICE_CONFIG.DEFAULTS.DUE_DAYS === 0) {
        return date.toISOString().split('T')[0];
    }
    date.setDate(date.getDate() + ART_INVOICE_CONFIG.DEFAULTS.DUE_DAYS);
    return date.toISOString().split('T')[0];
}

// Helper function to check if invoice is overdue
function isInvoiceOverdue(dueDate, status) {
    if (status === ART_INVOICE_CONFIG.INVOICE_STATUSES.PAID || 
        status === ART_INVOICE_CONFIG.INVOICE_STATUSES.VOIDED ||
        status === ART_INVOICE_CONFIG.INVOICE_STATUSES.CANCELLED) {
        return false;
    }
    
    const today = new Date();
    const due = new Date(dueDate);
    return today > due;
}

// Make configuration and helpers available globally
window.ART_INVOICE_CONFIG = ART_INVOICE_CONFIG;
window.getServiceCodeInfo = getServiceCodeInfo;
window.getTimeFromServiceCode = getTimeFromServiceCode;
window.suggestServiceCode = suggestServiceCode;
window.formatCurrency = formatCurrency;
window.formatDateConfig = formatDateConfig;
window.calculateDueDate = calculateDueDate;
window.isInvoiceOverdue = isInvoiceOverdue;