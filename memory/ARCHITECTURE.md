# NWCA System Architecture Patterns

## Overview
This document contains the advanced architectural patterns and system design decisions that power the Northwest Custom Apparel pricing and quote system.

## 1. Adapter Architecture Pattern

**Pattern**: BaseAdapter → DTGAdapter/DTFAdapter/etc. inheritance
**Location**: `/shared_components/js/*-adapter.js`

```javascript
// All adapters follow this pattern
class DTGAdapter extends BaseAdapter {
    constructor() {
        super('dtg', {
            appKey: 'a0e150002eb9491a50104c1d99d7',
            debug: true,
            errorMessageId: 'caspio-dtg-error-message'
        });
    }

    async processSpecificData(masterBundle) {
        // Store master bundle globally for compatibility
        window.dtgMasterPriceBundle = masterBundle;

        // Update UI based on bundle data
        this.updateLocationDropdownFromBundle(masterBundle);

        // Dispatch standardized event
        this.dispatchEvent('pricingDataLoaded', {
            embellishmentType: 'dtg',
            bundle: masterBundle
        });
    }
}
```

**Key Components**:
- **Master Bundle Data Flow**: Caspio → PostMessage → Adapter → Event → UI
- **Standardized Events**: All adapters dispatch `pricingDataLoaded` for UI components
- **Global Storage**: Adapters store data in `window.{type}MasterPriceBundle` for compatibility
- **Error Handling**: Centralized error display via `errorMessageId` containers

**When to Use**: For product pricing calculators that need real-time data from Caspio datapages

## 2. Quote Builder Safety Features

**Pattern**: QuoteBuilderBase with auto-save, error recovery, and data protection
**Location**: `/shared_components/js/quote-builder-base.js`

```javascript
class QuoteBuilderBase {
    constructor(config) {
        this.initializeAutoSave();        // Save every 30 seconds
        this.initializeErrorHandling();   // Global error boundaries
        this.initializeBeforeUnload();    // Prevent data loss
    }

    async safeExecute(fn, errorMessage = 'An error occurred') {
        try {
            this.showLoading(true);
            const result = await fn();
            this.showLoading(false);
            return result;
        } catch (error) {
            console.error(errorMessage, error);
            this.showError(errorMessage + '. Please try again or contact support.');
            this.saveToStorage(); // Backup on error
            return null;
        }
    }
}
```

**Safety Features**:
- **Auto-save**: Saves to localStorage every 30 seconds if changes detected
- **Error Boundaries**: Catches unhandled promise rejections and JS errors
- **Before-unload Protection**: Warns users about unsaved changes
- **Graceful Degradation**: Always saves locally when operations fail

**When to Use**: For any multi-step form or calculator where data loss is unacceptable

## 3. Dual API Integration Strategy

**Pattern**: Caspio datapages for calculations + Heroku proxy for database operations

```javascript
// Pricing calculations: Direct Caspio datapage
const pricingFrame = document.getElementById('caspio-pricing-frame');
pricingFrame.src = `https://c3eku948.caspio.com/dp/${appKey}/emb.html?${params}`;

// Database operations: Heroku proxy
const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData)
});
```

**Use Cases**:
- **Caspio Datapages**: Complex pricing calculations, master bundle generation
- **Heroku Proxy**: CRUD operations, quote persistence, cart management
- **Why Both**: Caspio excels at calculations, proxy provides clean REST API

**Architecture Decision**: Caspio handles compute-heavy pricing logic while proxy provides standard API patterns

## 4. Configuration Management System

**Pattern**: Centralized configuration in `/shared_components/js/app-config.js`

```javascript
window.NWCA_APP_CONFIG = {
    FEES: {
        LTM_CAP_MINIMUM_QUANTITY: 24,
        LTM_CAP_FEE_AMOUNT: 50.00
    },
    MESSAGES: {
        CONTACT_PHONE_NUMBER: "253-922-5793",
        SELECT_QUANTITY_ALERT: "Please select at least one size and quantity."
    },
    FEATURES: {
        CART_ENABLED: false,
        QUOTE_MODE: true
    }
};

// Usage throughout the app
if (quantity < NWCA_APP_CONFIG.FEES.LTM_CAP_MINIMUM_QUANTITY) {
    showLTMWarning();
}
```

**Configuration Categories**:
- **FEES**: Business logic constants (minimums, charges)
- **MESSAGES**: User-facing text and phone numbers
- **FEATURES**: Feature flags and mode switches
- **API_ENDPOINTS**: External service URLs

**Benefits**: Single source of truth, easy environment configuration, prevents hardcoded values

## 5. Shared Component Architecture

**Pattern**: Universal components with dependency injection

```javascript
// Universal Header Component
window.UniversalHeader = {
    init(config = {}) {
        this.config = {
            showCart: true,
            showSearch: true,
            logoUrl: 'https://cdn.caspio.com/A0E15000/...',
            ...config
        };
        this.render();
    },

    render() {
        const headerHTML = this.generateHeaderHTML();
        document.getElementById('header-placeholder').innerHTML = headerHTML;
        this.attachEventListeners();
    }
};
```

**Shared Components Include**:
- **Universal Header**: Navigation with cart count, search, mobile menu
- **Image Gallery**: Product zoom, thumbnails, lazy loading
- **Product Display**: Price formatting, inventory status, add-to-cart
- **Loading Animations**: Consistent loading states across all pages

**Benefits**: Code reuse, consistent UI, centralized updates, reduced maintenance

## 6. Error Handling Philosophy

**Pattern**: "Never fail silently" with graceful degradation

```javascript
// ❌ WRONG - Silent failure
try {
    const pricing = await fetchPricing();
    return pricing;
} catch (error) {
    return getCachedPricing(); // User doesn't know it failed
}

// ✅ CORRECT - Visible failure with backup
try {
    const pricing = await fetchPricing();
    return pricing;
} catch (error) {
    this.showError('Unable to load current pricing. Please refresh or call 253-922-5793.');
    console.error('Pricing API failed:', error);

    // Optional: Save state for recovery
    this.saveToLocalStorage();
    throw error; // Don't continue with wrong data
}
```

**Error Handling Levels**:
1. **User Notification**: Always show user-friendly error messages
2. **Console Logging**: Technical details for debugging
3. **Local Backup**: Save state when possible for recovery
4. **Graceful Degradation**: Disable features rather than show wrong data

**Philosophy**: Wrong pricing data is worse than showing an error message

## 7. Development Monitoring System

**Pattern**: Optional file access monitoring for development
**Location**: `/server.js` with optional monitoring modules

```javascript
// Optional monitoring (development only)
if (process.env.ENABLE_MONITORING === 'true') {
    const FileAccessMonitor = require('./scripts/safety-tools/file-access-monitor');
    const autoRecovery = require('./scripts/safety-tools/auto-recovery');

    app.use(monitor.middleware());
    app.use(autoRecovery.middleware());
}
```

**Monitoring Features**:
- **File Access Tracking**: Logs all file reads/writes for debugging
- **Auto-recovery**: Detects and fixes common file corruption issues
- **Dependency Mapping**: Tracks file relationships for safe refactoring
- **Quarantine System**: 90-day retention of deleted files

**Usage**: `ENABLE_MONITORING=true npm start` (development only)

## 8. Quote System Database Pattern

**Pattern**: BaseQuoteService inheritance with standardized quote generation
**Location**: `/shared_components/js/base-quote-service.js`

```javascript
class BaseQuoteService {
    constructor(config = {}) {
        this.prefix = config.prefix || 'QUOTE';  // e.g., 'DTG', 'EMB'
        this.storagePrefix = config.storagePrefix || 'quote';
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    generateQuoteID() {
        const now = new Date();
        const dateKey = String(now.getMonth() + 1).padStart(2, '0') +
                       String(now.getDate()).padStart(2, '0');

        // Get daily sequence from sessionStorage
        const storageKey = `${this.storagePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        return `${this.prefix}${dateKey}-${sequence}`;
    }
}
```

**Database Pattern**:
- **Two Tables**: `quote_sessions` (header) + `quote_items` (line items)
- **Quote ID Format**: `[PREFIX][MMDD]-[sequence]` (e.g., DTG0130-1)
- **Daily Reset**: Sequence resets daily, old sequences auto-cleaned
- **Inheritance**: All calculators extend BaseQuoteService for consistency

## 9. Cart Integration Architecture

**Pattern**: NWCACart module with local + server synchronization

```javascript
window.NWCACart = (function() {
    // Local state with server sync
    let cartState = {
        sessionId: null,
        items: [],
        loading: false,
        error: null
    };

    async function syncWithServer() {
        // Sync strategy:
        // 1. If server has items, use them
        // 2. If server empty but local has items, push to server
        // 3. Handle conflicts gracefully

        if (serverItems.length > 0) {
            cartState.items = serverItems;
        } else if (cartState.items.length > 0) {
            await pushLocalItemsToServer();
        }
    }
})();
```

**Integration Features**:
- **Dual Storage**: localStorage for offline + database for persistence
- **Session Management**: Generates unique session IDs for tracking
- **Embellishment Validation**: Warns when mixing different decoration types
- **Real-time Sync**: Updates across tabs/windows via storage events

**Business Rules**: Single embellishment type per cart (warns on conflicts)

## 10. Dashboard Module System

**Pattern**: Modular JavaScript architecture for admin tools
**Location**: `/dashboards/` with shared components

```javascript
// Dashboard modules follow this pattern
window.DashboardModule = {
    employees: null,
    navigation: null,
    utilities: null,

    init() {
        // Load all modules
        this.employees = new EmployeeManager();
        this.navigation = new NavigationManager();
        this.utilities = new UtilitiesManager();

        // Initialize UI
        this.setupCollapsibleSections();
        this.loadCharts();
    },

    setupCollapsibleSections() {
        document.querySelectorAll('.nav-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.nav-section');
                section.classList.toggle('collapsed');
            });
        });
    }
};
```

**Dashboard Features**:
- **Modular Loading**: Separate JS files for each major feature
- **Collapsible Navigation**: Organized sections with smooth animations
- **Chart Integration**: Chart.js for analytics and reporting
- **Role-based Views**: Different interfaces for different user types

**Architecture Benefits**: Maintainable code, lazy loading, role-specific features

## 11. Progressive Disclosure UI Pattern

**Pattern**: Show information contextually rather than all at once
**Location**: DTG pricing page size upcharge tooltip (added 2025-09-30)
**Reference**: `/calculators/dtg-pricing.html:2169-2239`

**Problem**: Too much information overwhelms users and clutters clean interfaces

**Solution**: Use icons with tooltips/popovers to reveal information on demand

```javascript
// Info icon triggers contextual display
<div class="live-price-amount-wrapper">
    <span class="live-price-amount">$15.00</span>
    <i class="fas fa-info-circle upcharge-info-icon"></i>
</div>

// Tooltip appears on demand with filtered data
function updateUpchargeTooltipContent() {
    // Only show sizes that exist for this product
    const availableSizes = pricingData?.pricing?.sizes?.map(s => s.size) || [];

    const upcharges = {};
    Object.entries(allUpcharges).forEach(([size, amount]) => {
        if (availableSizes.includes(size) && amount > 0) {
            upcharges[size] = amount;
        }
    });

    // Build display with filtered data
    // ...
}
```

**Key Architectural Principles**:
1. **Clean Primary Interface** - Main UI shows only essential information
2. **Contextual Revelation** - Additional details appear when user needs them
3. **Data Filtering** - Show only relevant information (sizes that exist)
4. **Responsive Behavior** - Adapt to device (hover on desktop, tap on mobile)

**Benefits**:
- Cleaner initial UI reduces cognitive load
- Information available when needed without cluttering interface
- Scales well to mobile devices
- Maintains focus on primary task (product selection)
- Allows more flexible data presentation

**Implementation Components**:
- **Trigger**: Icon or subtle UI element
- **Content**: Dynamically generated based on context
- **Positioning**: Absolute positioning relative to trigger
- **Dismissal**: Click outside or explicit close action

**When to Use**:
- Auxiliary information (not critical to main flow)
- Product-specific details (sizes, options, specifications)
- Help text and explanations
- Secondary pricing details (upcharges, fees)
- Technical specifications or requirements

**When NOT to Use**:
- Critical information users must see immediately
- Primary call-to-action elements
- Error messages or warnings
- Legal disclaimers or required notices

**Related Patterns**:
- Tooltip positioning (CSS absolute/relative)
- Event delegation (desktop hover vs mobile tap)
- Data filtering (show only relevant subset)
- Responsive design (adapt to viewport size)

## System Architecture Overview

### Key Components:
1. **Adapters** (`/shared_components/js/*-adapter.js`) - Handle pricing data from Caspio
2. **Quote System** - Two tables: `quote_sessions` + `quote_items`, ID pattern: `[PREFIX][MMDD]-seq`
3. **API Proxy** - `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
4. **Cart Management** - Session-based, single embellishment type per cart

### Data Flow Architecture

```
User Interaction → Frontend → API Proxy → Caspio Database
        ↓              ↓           ↓              ↓
   Form Submit    Validation   Heroku Server   Data Storage
        ↓              ↓           ↓              ↓
   Event Handler   Format Data  Process       Return Data
        ↓              ↓           ↓              ↓
   Display ← Update UI ← Transform ← Response
```

### Master Bundle Flow (Pricing Data)

```
Caspio DataPage (iframe) → PostMessage → Adapter
         ↓                      ↓           ↓
   Calculate Prices      Send Bundle    Store Data
         ↓                      ↓           ↓
    All Permutations     JSON Package  Local Memory
         ↓                      ↓           ↓
   User Selection ← Extract Price ← Dispatch Event
```

---

**Documentation Type**: System Architecture Reference
**Parent Document**: [DOCS_INDEX.md](/docs/DOCS_INDEX.md)
**Related**: [Code Patterns](PATTERNS.md) | [Workflows](CLAUDE_WORKFLOW.md)