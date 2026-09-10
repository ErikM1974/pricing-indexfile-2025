/**
 * House Accounts Dashboard
 * View House accounts and assign them to Taneisha or Nika
 *
 * API Endpoints:
 * - GET /api/house-accounts - List accounts with filters
 * - GET /api/house-accounts/stats - Stats by assignee
 * - POST /api/taneisha-accounts - Create account in Taneisha's table
 * - POST /api/nika-accounts - Create account in Nika's table
 * - DELETE /api/house-accounts/:id - Remove from House table
 */

// ============================================================
// SERVICE CLASS
// ============================================================
var HOUSACCO_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var housaccoLog = HOUSACCO_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)

class HouseAccountsService {
    constructor() {
        // Use same-origin proxy for security (session validated on each request)
        // The proxy at /api/crm-proxy/* forwards to caspio-pricing-proxy with auth
        this.baseURL = '';

        this.accounts = [];
        this.stats = null;
        this.filters = {
            search: '',
            assignedTo: ''
        };
    }

    /**
     * Handle 401 unauthorized - redirect to login
     */
    handleAuthError(response) {
        if (response.status === 401) {
            // Session expired - redirect to login with return URL
            window.location.href = '/dashboards/staff-login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return true;
        }
        return false;
    }

    /**
     * Fetch all House accounts with optional filters
     * Includes retry logic for 429 rate limit errors
     */
    async fetchAccounts(filters = {}, retries = 3) {
        const params = new URLSearchParams();

        if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
        if (filters.search) params.append('search', filters.search);

        const url = `${this.baseURL}/api/crm-proxy/house-accounts${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return [];

        // Retry on rate limit with exponential backoff (5s, 10s, 15s)
        if (response.status === 429 && retries > 0) {
            const waitTime = (4 - retries) * 5000; // 5s, 10s, 15s
            console.warn(`Rate limited (429), retrying in ${waitTime / 1000}s... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.fetchAccounts(filters, retries - 1);
        }

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data && (data.Result || data.accounts || data);
        if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
            throw new Error('The account response is incomplete. Please retry.');
        }
        this.accounts = rows;

        return this.accounts;
    }

    /**
     * Fetch stats for House accounts
     * Includes retry logic for 429 rate limit errors
     */
    async fetchStats(retries = 3) {
        const response = await fetch(`${this.baseURL}/api/crm-proxy/house-accounts/stats`, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

        // Retry on rate limit with exponential backoff (5s, 10s, 15s)
        if (response.status === 429 && retries > 0) {
            const waitTime = (4 - retries) * 5000;
            console.warn(`Rate limited (429) on stats, retrying in ${waitTime / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.fetchStats(retries - 1);
        }

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const stats = await response.json();
        if (!stats || typeof stats.total !== 'number' || !Number.isFinite(stats.total) || !stats.byAssignee || typeof stats.byAssignee !== 'object' || Array.isArray(stats.byAssignee)) {
            throw new Error('The account counts are incomplete. Please retry.');
        }
        this.stats = stats;
        return this.stats;
    }

    /**
     * Fetch YTD sales for House accounts
     * Returns sales grouped by Assigned_To (Ruthie, Erik, Web, Jim, House)
     * Includes retry logic for 429 rate limit errors
     */
    async fetchSales(retries = 3) {
        const response = await fetch(`${this.baseURL}/api/crm-proxy/house-accounts/sales`, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

        // Retry on rate limit with exponential backoff (5s, 10s, 15s)
        if (response.status === 429 && retries > 0) {
            const waitTime = (4 - retries) * 5000;
            console.warn(`Rate limited (429) on sales, retrying in ${waitTime / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.fetchSales(retries - 1);
        }

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const sales = await response.json();
        if (!sales || ['totalRevenue', 'totalOrders', 'accountsTracked'].some(key => typeof sales[key] !== 'number' || !Number.isFinite(sales[key])) || !sales.byAssignee || typeof sales.byAssignee !== 'object' || Array.isArray(sales.byAssignee) || Object.values(sales.byAssignee).some(row => !row || typeof row.revenue !== 'number' || !Number.isFinite(row.revenue))) {
            throw new Error('The sales response is incomplete. Please retry.');
        }
        this.sales = sales;
        return this.sales;
    }

    /**
     * Assign a House account to a rep (moves record)
     * 1. POST to rep's table to create account
     * 2. DELETE from House table
     * @param {Object} account - The account to assign
     * @param {string} repName - 'Taneisha' or 'Nika'
     */
    async assignToRep(account, repName) {
        const endpoint = repName === 'Taneisha'
            ? '/api/crm-proxy/taneisha-accounts'
            : '/api/crm-proxy/nika-accounts';

        // 1. Create in rep's table with Win-Back tier
        const createResponse = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                ID_Customer: account.ID_Customer,
                CompanyName: account.CompanyName,
                Account_Tier: `Win Back '26 ${repName.toUpperCase()}`
            })
        });

        if (this.handleAuthError(createResponse)) return false;

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create account in ${repName}'s table: ${createResponse.status} - ${errorText}`);
        }

        // 2. Delete from House table
        const deleteResponse = await fetch(`${this.baseURL}/api/crm-proxy/house-accounts/${account.ID_Customer}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (this.handleAuthError(deleteResponse)) return false;

        if (!deleteResponse.ok) {
            throw new Error(`Failed to remove account from House table: ${deleteResponse.status}`);
        }

        // 3. ALSO update Sales_Reps_2026 (ownership source of truth). Without
        // this, the next sync-ownership run reads the OLD owner from
        // Sales_Reps_2026 and silently reverts the assignment — the Caspio
        // rep-table row alone doesn't survive (caught 2026-07-19). Same
        // contract the reconcile-modal "Assign to…" dropdown uses. Note the
        // durable home is still ShopWorks Cust.CustomerServiceRep — the ODBC
        // agent re-mirrors it if that customer's ShopWorks row changes.
        const fullName = repName === 'Taneisha' ? 'Taneisha Clark' : 'Nika Lao';
        const swOk = await this.updateShopWorksRep(
            account.ID_Customer, fullName, `Win Back '26 ${repName.toUpperCase()}`
        );
        if (!swOk) {
            // Visible, not silent: the CRM move happened but ownership didn't stick.
            throw new Error(`Account moved to ${repName}'s CRM, but the Sales_Reps_2026 ownership update FAILED — the next sync will revert it. Also set ${fullName} as CustomerServiceRep in ShopWorks.`);
        }

        return { success: true, repName };
    }

    /**
     * Filter accounts client-side
     */
    filterAccounts(filters) {
        return this.accounts.filter(account => {
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const companyName = (account.CompanyName || '').toLowerCase();
                if (!companyName.includes(searchTerm)) {
                    return false;
                }
            }

            if (filters.assignedTo) {
                const assignee = (account.Assigned_To || '').toLowerCase();
                if (!assignee.includes(filters.assignedTo.toLowerCase())) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Reconcile accounts - Find customers with orders not in any account list
     * @param {boolean} autoAdd - If true, automatically add missing customers to House
     */
    async reconcileAccounts(autoAdd = false) {
        const url = autoAdd
            ? `${this.baseURL}/api/crm-proxy/house-accounts/reconcile?autoAdd=true`
            : `${this.baseURL}/api/crm-proxy/house-accounts/reconcile`;

        const response = await fetch(url, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Fetch full reconciliation report - all authority conflicts across all reps
     * @returns {Object} - Report data with conflicts grouped by rep
     */
    async fetchFullReconciliation() {
        const url = `${this.baseURL}/api/crm-proxy/house-accounts/full-reconciliation`;

        const response = await fetch(url, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Calculate stats from loaded accounts
     */
    calculateLocalStats() {
        const stats = {
            total: 0,
            byAssignee: {}
        };

        this.accounts.forEach(account => {
            stats.total++;

            const assignee = account.Assigned_To || 'Unassigned';
            if (!stats.byAssignee[assignee]) {
                stats.byAssignee[assignee] = 0;
            }
            stats.byAssignee[assignee]++;
        });

        return stats;
    }

    /**
     * Fetch ShopWorks rep assignment from Sales_Reps_2026
     * @param {number} customerId - The customer ID to look up
     * @returns {Object|null} - { CustomerServiceRep, Account_Tier, ... } or { notFound: true } or { rateLimited: true } or null on error
     */
    async fetchShopWorksRep(customerId) {
        try {
            const url = `${this.baseURL}/api/crm-proxy/sales-reps-2026/${customerId}`;

            const response = await fetch(url, { credentials: 'same-origin' });

            if (this.handleAuthError(response)) {
                housaccoLog(`[SW Lookup] ID ${customerId}: Auth error`);
                return null;
            }
            if (response.status === 404) {
                housaccoLog(`[SW Lookup] ID ${customerId}: NOT FOUND (404)`);
                return { notFound: true };
            }
            if (response.status === 429) {
                housaccoLog(`[SW Lookup] ID ${customerId}: RATE LIMITED (429)`);
                return { rateLimited: true };
            }
            if (!response.ok) {
                housaccoLog(`[SW Lookup] ID ${customerId}: Error (${response.status})`);
                return null;
            }

            const data = await response.json();

            if (data.record) {
                housaccoLog(`[SW Lookup] ID ${customerId}: Found - Rep="${data.record.CustomerServiceRep}"`);
                return data.record;
            } else {
                housaccoLog(`[SW Lookup] ID ${customerId}: No record in response`);
                return null;
            }
        } catch (error) {
            console.error(`[SW Lookup] ID ${customerId}: EXCEPTION:`, error);
            return null;
        }
    }

    /**
     * Batch fetch ShopWorks rep assignments for multiple customers
     * Uses single API call with OR-based WHERE clause to avoid rate limiting
     * @param {number[]} customerIds - Array of customer IDs
     * @returns {Map} - Map of customerId -> shopWorksData
     */
    async fetchShopWorksRepsBatch(customerIds) {
        if (!customerIds || customerIds.length === 0) {
            return new Map();
        }

        try {
            housaccoLog(`[SW Batch] Fetching ${customerIds.length} customers in single request...`);

            const response = await fetch(
                `${this.baseURL}/api/crm-proxy/sales-reps-2026/batch`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ ids: customerIds })
                }
            );

            if (this.handleAuthError(response)) return new Map();

            if (!response.ok) {
                console.error(`[SW Batch] API error: ${response.status}`);
                throw new Error(`Batch failed: ${response.status}`);
            }

            const data = await response.json();
            const results = new Map();

            // Map results by ID_Customer
            (data.records || []).forEach(record => {
                results.set(record.ID_Customer, record);
            });

            // Mark missing IDs as notFound
            customerIds.forEach(id => {
                if (!results.has(id)) {
                    results.set(id, { notFound: true });
                }
            });

            housaccoLog(`[SW Batch] Fetched ${data.count}/${customerIds.length} records`);
            return results;
        } catch (error) {
            console.error('[SW Batch] Error:', error);
            return new Map();
        }
    }

    /**
     * Update ShopWorks rep assignment in Sales_Reps_2026
     * @param {number} customerId - The customer ID to update
     * @param {string} repName - Full rep name (e.g., "Taneisha Clark")
     * @param {string} accountTier - Account tier (e.g., "Win Back '26 TANEISHA")
     * @returns {boolean} - Success status
     */
    async updateShopWorksRep(customerId, repName, accountTier) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/crm-proxy/sales-reps-2026/${customerId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        CustomerServiceRep: repName,
                        Account_Tier: accountTier
                    })
                }
            );
            if (this.handleAuthError(response)) return false;
            return response.ok;
        } catch (error) {
            console.error('Error updating ShopWorks rep:', error);
            return false;
        }
    }

    /**
     * Fetch available tiers from Sales_Reps_2026 stats
     * @returns {string[]} - Array of tier names
     */
    async fetchAvailableTiers() {
        try {
            const response = await fetch(
                `${this.baseURL}/api/crm-proxy/sales-reps-2026/stats`,
                { credentials: 'same-origin' }
            );
            if (this.handleAuthError(response)) return [];
            if (!response.ok) return [];

            const data = await response.json();
            return Object.keys(data.byTier || {});
        } catch (error) {
            console.error('Error fetching tiers:', error);
            return [];
        }
    }
}


// ============================================================
// CONTROLLER CLASS
// ============================================================

class HouseAccountsController {
    constructor() {
        this.service = new HouseAccountsService();

        // DOM elements
        this.elements = {};

        // State
        this.filteredAccounts = [];
        this.searchDebounceTimer = null;
        this.pendingAssignment = null;

        // Bind methods
        this.handleSearch = this.handleSearch.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
    }

    /**
     * Initialize the controller
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        // Who is signed in — the assignment audit trail used to hardcode "Erik".
        fetch('/api/crm-session/me', { credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : null))
            .then((me) => { if (me && (me.firstName || me.email)) this.staffName = me.firstName || String(me.email).split('@')[0]; })
            .catch(() => { /* keep the fallback */ });
        await this.retryLoad();
    }

    /** (Re)load everything — first boot and the error banner's Retry. */
    async retryLoad() {
        this.hideError();
        try {
            await this.loadData();
            // Load sync status indicator
            await this.loadSyncStatus();
        } catch (error) {
            console.error('[HouseAccounts] load failed:', error);
            this.service.accounts = [];
            this.filteredAccounts = [];
            this.elements.accountsGrid.innerHTML = '';
            this.updateAccountsCount();
            document.querySelectorAll('.stat-value').forEach(node => { node.textContent = '—'; });
            document.getElementById('houseDataSubline')?.remove();
            this.showError('Unable to load House accounts (' + (error && error.message ? error.message : 'unknown error') + ').', true);
        }
    }

    hideError() {
        if (this.elements.errorBanner) this.elements.errorBanner.classList.remove('show');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Error banner
            errorBanner: document.getElementById('error-banner'),
            errorMessage: document.getElementById('error-message'),
            errorRetry: document.getElementById('error-retry'),

            // Stats
            statTotal: document.getElementById('stat-total'),
            statRuthie: document.getElementById('stat-ruthie'),
            statErik: document.getElementById('stat-erik'),
            statWeb: document.getElementById('stat-web'),
            statJim: document.getElementById('stat-jim'),
            statHouse: document.getElementById('stat-house'),
            statOther: document.getElementById('stat-other'),

            // Filters
            searchInput: document.getElementById('filter-search'),
            assigneeSelect: document.getElementById('filter-assignee'),
            clearFiltersBtn: document.getElementById('clear-filters-btn'),

            // Accounts
            accountsGrid: document.getElementById('accounts-grid'),
            accountsCount: document.getElementById('accounts-count'),
            loadingOverlay: document.getElementById('loading-overlay'),
            emptyState: document.getElementById('empty-state'),

            // Reconcile
            reconcileBtn: document.getElementById('reconcile-btn'),
            reconcileModalOverlay: document.getElementById('reconcile-modal-overlay'),
            reconcileModalClose: document.getElementById('reconcile-modal-close'),
            reconcileRefreshBtn: document.getElementById('reconcile-refresh-btn'),
            reconcileLoading: document.getElementById('reconcile-loading'),
            reconcileResults: document.getElementById('reconcile-results'),
            reconcileSummary: document.getElementById('reconcile-summary'),
            reconcileTableBody: document.getElementById('reconcile-table-body'),
            reconcileEmpty: document.getElementById('reconcile-empty'),
            reconcileFooter: document.getElementById('reconcile-footer'),
            reconcileCancel: document.getElementById('reconcile-cancel'),
            reconcileAddAll: document.getElementById('reconcile-add-all'),

            // Confirmation Modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmAccountPreview: document.getElementById('confirm-account-preview'),
            confirmClose: document.getElementById('confirm-close'),
            confirmCancel: document.getElementById('confirm-cancel'),
            confirmSubmit: document.getElementById('confirm-submit'),

            // Toast
            celebrationToast: document.getElementById('celebration-toast'),

            // Gap Report Modal
            gapReportBtn: document.getElementById('gap-report-btn'),
            swTodoBtn: document.getElementById('sw-todo-btn'),
            swTodoCount: document.getElementById('sw-todo-count'),
            swTodoOverlay: document.getElementById('sw-todo-modal-overlay'),
            swTodoBody: document.getElementById('sw-todo-body'),
            swTodoClose: document.getElementById('sw-todo-close'),
            swTodoCopy: document.getElementById('sw-todo-copy'),
            gapReportModalOverlay: document.getElementById('gap-report-modal-overlay'),
            gapReportModalClose: document.getElementById('gap-report-modal-close'),
            gapReportRefreshBtn: document.getElementById('gap-report-refresh-btn'),
            gapReportLoading: document.getElementById('gap-report-loading'),
            gapReportContent: document.getElementById('gap-report-content'),
            gapReportClose: document.getElementById('gap-report-close'),

            // Sync Controls (Erik's Control Center)
            syncAllBtn: document.getElementById('sync-all-btn'),
            syncHouseBtn: document.getElementById('sync-house-btn')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search with debounce
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this.handleSearch);
        }

        // Filter dropdown
        if (this.elements.assigneeSelect) {
            this.elements.assigneeSelect.addEventListener('change', this.handleFilterChange);
        }

        // Clear filters
        if (this.elements.clearFiltersBtn) {
            this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Reconcile button and modal
        if (this.elements.reconcileBtn) {
            this.elements.reconcileBtn.addEventListener('click', () => this.openReconcileModal());
        }
        if (this.elements.reconcileModalClose) {
            this.elements.reconcileModalClose.addEventListener('click', () => this.closeReconcileModal());
        }
        if (this.elements.reconcileRefreshBtn) {
            this.elements.reconcileRefreshBtn.addEventListener('click', () => this.refreshReconcileData());
        }
        if (this.elements.reconcileCancel) {
            this.elements.reconcileCancel.addEventListener('click', () => this.closeReconcileModal());
        }
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.addEventListener('click', () => this.addAllMissingCustomers());
        }
        if (this.elements.reconcileModalOverlay) {
            this.elements.reconcileModalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.reconcileModalOverlay) {
                    this.closeReconcileModal();
                }
            });
        }

        // Confirmation modal
        if (this.elements.confirmClose) {
            this.elements.confirmClose.addEventListener('click', () => this.closeConfirmModal());
        }
        if (this.elements.confirmCancel) {
            this.elements.confirmCancel.addEventListener('click', () => this.closeConfirmModal());
        }
        if (this.elements.confirmSubmit) {
            this.elements.confirmSubmit.addEventListener('click', () => this.executeAssignment());
        }
        if (this.elements.confirmModal) {
            this.elements.confirmModal.addEventListener('click', (e) => {
                if (e.target === this.elements.confirmModal) {
                    this.closeConfirmModal();
                }
            });
        }

        // Gap Report button and modal
        if (this.elements.gapReportBtn) {
            this.elements.gapReportBtn.addEventListener('click', () => this.openGapReportModal());
        }

        // ShopWorks To-Do button and modal
        if (this.elements.swTodoBtn) {
            this.elements.swTodoBtn.addEventListener('click', () => this.openShopWorksTodoModal());
            if (this.elements.swTodoClose) this.elements.swTodoClose.addEventListener('click', () => this.closeShopWorksTodoModal());
            if (this.elements.swTodoCopy) this.elements.swTodoCopy.addEventListener('click', () => this.copyShopWorksTodo());
            if (this.elements.swTodoOverlay) {
                this.elements.swTodoOverlay.addEventListener('click', (e) => {
                    if (e.target === this.elements.swTodoOverlay) this.closeShopWorksTodoModal();
                });
            }
            this.refreshShopWorksTodoCount();
        }
        if (this.elements.gapReportModalClose) {
            this.elements.gapReportModalClose.addEventListener('click', () => this.closeGapReportModal());
        }
        if (this.elements.gapReportRefreshBtn) {
            this.elements.gapReportRefreshBtn.addEventListener('click', () => this.refreshGapReport());
        }
        if (this.elements.gapReportClose) {
            this.elements.gapReportClose.addEventListener('click', () => this.closeGapReportModal());
        }
        if (this.elements.gapReportModalOverlay) {
            this.elements.gapReportModalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.gapReportModalOverlay) {
                    this.closeGapReportModal();
                }
            });
        }

        // Keyboard shortcuts — Esc closes whichever modal is open (incl. the to-do + assign modals).
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const dialog = Array.from(document.querySelectorAll('dialog[open]')).pop();
                const controls = dialog && Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')).filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
                if (controls && controls.length) {
                    const first = controls[0], last = controls[controls.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            if (e.key === 'Escape') {
                this.closeReconcileModal();
                this.closeConfirmModal();
                this.closeGapReportModal();
                this.closeShopWorksTodoModal();
                this.closeAssignModal();
                return;
            }
            // Expandable rows/headers are data-call click targets; give them a keyboard path.
            if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('.gap-rep-header[data-call]')) {
                e.preventDefault();
                e.target.click();
            }
        });

        // Stat tile click handlers for filtering (data-assignee: '' = show all)
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => this.filterByStatCard(card));
        });

        // Sync controls (Erik's Control Center)
        if (this.elements.syncAllBtn) {
            this.elements.syncAllBtn.addEventListener('click', () => this.syncAllCRM());
        }
        if (this.elements.syncHouseBtn) {
            this.elements.syncHouseBtn.addEventListener('click', () => this.syncHouseOnly());
        }
    }

    /**
     * Filter accounts by clicking a stat card
     * @param {HTMLElement} card - The clicked stat card
     */
    filterByStatCard(card) {
        // Keyed by data-assignee, not the label text — the total tile's label is "YTD Sales", and
        // matching on "Total" used to set the assignee filter to a value nobody has (empty grid).
        const assignee = card.dataset.assignee || '';
        const alreadyOn = this.service.filters.assignedTo === assignee && assignee !== '';

        if (!assignee || alreadyOn) {
            // Show all accounts (the total tile, or clicking the active tile again)
            this.clearFilters();
            return;
        }
        this._syncStatTiles(assignee);
        if (this.elements.assigneeSelect) {
            this.elements.assigneeSelect.value = assignee;
        }
        this.service.filters.assignedTo = assignee;
        this.applyFilters();
    }

    /** Highlight + aria-pressed on the tile whose data-assignee matches the active filter. */
    _syncStatTiles(assignee) {
        document.querySelectorAll('.stat-card').forEach(c => {
            const on = (c.dataset.assignee || '') === (assignee || '') && assignee !== '';
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    /**
     * Load accounts and stats from API
     */
    async loadData() {
        this.showLoading(true);

        try {
            // Load accounts, stats, and sales in parallel
            await Promise.all([
                this.service.fetchAccounts(),
                this.service.fetchStats(),
                this.service.fetchSales()
            ]);

            this.filteredAccounts = [...this.service.accounts];
            this.updateStats();
            this.renderAccounts();
            this.updateAccountsCount();
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Handle search input with debounce
     */
    handleSearch(e) {
        clearTimeout(this.searchDebounceTimer);

        this.searchDebounceTimer = setTimeout(() => {
            this.service.filters.search = e.target.value;
            this.applyFilters();
        }, 300);
    }

    /**
     * Handle filter dropdown changes
     */
    handleFilterChange() {
        const selectedAssignee = this.elements.assigneeSelect?.value || '';
        this.service.filters.assignedTo = selectedAssignee;

        // Sync stat tile active state with dropdown
        this._syncStatTiles(selectedAssignee);

        this.applyFilters();
    }

    /**
     * Apply current filters
     */
    applyFilters() {
        this.filteredAccounts = this.service.filterAccounts(this.service.filters);
        this.renderAccounts();
        this.updateAccountsCount();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        if (this.elements.assigneeSelect) this.elements.assigneeSelect.value = '';

        // Remove active state from all stat tiles
        this._syncStatTiles('');

        this.service.filters = {
            search: '',
            assignedTo: ''
        };

        this.filteredAccounts = [...this.service.accounts];
        this.renderAccounts();
        this.updateAccountsCount();
    }

    /**
     * Update stats display - shows YTD sales amounts with account counts
     */
    updateStats() {
        const stats = this.service.stats || this.service.calculateLocalStats();
        const sales = this.service.sales || { totalRevenue: 0, byAssignee: {} };

        // Helper to format sales amount
        const formatSales = (amount) => {
            const num = parseFloat(amount) || 0;
            if (num >= 1000) {
                return '$' + (num / 1000).toFixed(1) + 'k';
            }
            return '$' + num.toFixed(0);
        };

        // Update total - show total sales
        if (this.elements.statTotal) {
            this.elements.statTotal.textContent = formatSales(sales.totalRevenue || 0);
        }

        // Update assignee stats - show sales amount
        const byAssignee = stats.byAssignee || {};
        const salesByAssignee = sales.byAssignee || {};

        if (this.elements.statRuthie) {
            const ruthieSales = salesByAssignee['Ruthie']?.revenue || 0;
            this.elements.statRuthie.textContent = formatSales(ruthieSales);
        }
        if (this.elements.statErik) {
            const erikSales = salesByAssignee['Erik']?.revenue || 0;
            this.elements.statErik.textContent = formatSales(erikSales);
        }
        if (this.elements.statWeb) {
            const webSales = salesByAssignee['Web']?.revenue || 0;
            this.elements.statWeb.textContent = formatSales(webSales);
        }
        if (this.elements.statJim) {
            const jimSales = salesByAssignee['Jim']?.revenue || 0;
            this.elements.statJim.textContent = formatSales(jimSales);
        }
        if (this.elements.statHouse) {
            const houseSales = salesByAssignee['House']?.revenue || 0;
            this.elements.statHouse.textContent = formatSales(houseSales);
        }
        // "Other" surfaces orders the API counts but the 5 standard buckets miss
        // (e.g. orders on house customers written by Nika/Taneisha or non-standard
        // assignee names). Without this card the per-assignee stats silently fail
        // to sum to YTD Sales — same trust problem as the rep CRM tier mismatch.
        if (this.elements.statOther) {
            const otherSales = salesByAssignee['Other']?.revenue || 0;
            this.elements.statOther.textContent = formatSales(otherSales);
        }
        this._renderLiveDataSubline(sales);
    }

    /**
     * Inject "Live YTD across N house accounts · M orders" under the stats grid.
     * Idempotent — removes any prior subline before re-inserting. Mirrors the
     * freshness pattern from rep-crm.js but labeled as live (no archive cron).
     */
    _renderLiveDataSubline(sales) {
        const existing = document.getElementById('houseDataSubline');
        if (existing) existing.remove();

        const grid = document.getElementById('stats-grid');
        if (!grid || !sales) return;

        const accounts = Number(sales.accountsTracked) || 0;
        const orders = Number(sales.totalOrders) || 0;
        if (!accounts && !orders) return;

        const line = document.createElement('div');
        line.id = 'houseDataSubline';
        line.className = 'house-data-subline';
        line.innerHTML = '<i class="fas fa-bolt" aria-hidden="true"></i><span>Live YTD across ' +
            accounts + ' house account' + (accounts === 1 ? '' : 's') +
            ' · ' + orders + ' order' + (orders === 1 ? '' : 's') + '</span>';
        grid.insertAdjacentElement('afterend', line);
    }

    /**
     * Update accounts count display
     */
    updateAccountsCount() {
        if (this.elements.accountsCount) {
            this.elements.accountsCount.textContent =
                `${this.filteredAccounts.length} account${this.filteredAccounts.length !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Render accounts grid
     */
    renderAccounts() {
        if (!this.elements.accountsGrid) return;

        if (this.filteredAccounts.length === 0) {
            this.elements.accountsGrid.innerHTML = '';
            if (this.elements.emptyState) {
                this.elements.emptyState.hidden = false;
            }
            return;
        }

        if (this.elements.emptyState) {
            this.elements.emptyState.hidden = true;
        }

        this.elements.accountsGrid.innerHTML = this.filteredAccounts.map(account => {
            const assignee = account.Assigned_To || 'Unassigned';
            const dateAdded = this.formatDate(account.Date_Added || account.PK_ID);

            // Get CSS class for assignee badge (first word, lowercase)
            const assigneeClass = (assignee || '').toLowerCase().split(' ')[0] || 'house';

            return `
                <div class="account-card" data-id="${account.ID_Customer}">
                    <div class="account-card-content">
                        <div class="card-header">
                            <div>
                                <h3 class="company-name">${this.escapeHtml(account.CompanyName)}</h3>
                            </div>
                            <span class="current-assignee ${assigneeClass}">
                                <i class="fas fa-user" aria-hidden="true"></i>&nbsp;${this.escapeHtml(assignee)}
                            </span>
                        </div>

                        <div class="account-meta">
                            ${dateAdded ? `
                                <span><i class="fas fa-calendar-plus" aria-hidden="true"></i> Added: ${dateAdded}</span>
                            ` : ''}
                            ${account.ID_Customer ? `
                                <span><i class="fas fa-hashtag" aria-hidden="true"></i> ID: ${account.ID_Customer}</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Prompt user to confirm assignment
     */
    promptAssign(customerId, repName) {
        const account = this.service.accounts.find(a => String(a.ID_Customer) === String(customerId));

        if (!account) {
            this.showError('Account not found');
            return;
        }

        this.pendingAssignment = { account, repName };

        // Update modal content
        if (this.elements.confirmTitle) {
            this.elements.confirmTitle.textContent = `Assign to ${repName}`;
        }

        if (this.elements.confirmMessage) {
            this.elements.confirmMessage.textContent = `This will move the account to ${repName}'s CRM as a Win-Back account.`;
        }

        if (this.elements.confirmAccountPreview) {
            this.elements.confirmAccountPreview.innerHTML = `
                <h3 class="company-name">${this.escapeHtml(account.CompanyName)}</h3>
                <span class="current-assignee">
                    <i class="fas fa-user" aria-hidden="true"></i>&nbsp;Currently: ${this.escapeHtml(account.Assigned_To || 'Unassigned')}
                </span>
            `;
        }

        if (this.elements.confirmSubmit) {
            this.elements.confirmSubmit.className = `btn-save ${repName.toLowerCase()}`;
            this.elements.confirmSubmit.innerHTML = `<i class="fas fa-check" aria-hidden="true"></i> Assign to ${repName}`;
        }

        // Show modal
        this._openOverlay(this.elements.confirmModal, this.elements.confirmSubmit);
    }

    /**
     * Close confirmation modal
     */
    closeConfirmModal() {
        this._closeOverlay(this.elements.confirmModal);
        this.pendingAssignment = null;
    }

    /** Open a .modal-overlay: remember the opener, move focus in. */
    _openOverlay(overlay, focusEl) {
        if (!overlay) return;
        if (!overlay.classList.contains('active')) overlay._returnFocus = document.activeElement;
        overlay.querySelector('.crm-modal-error')?.remove();
        overlay.classList.add('active');
        if (!overlay.open) overlay.showModal();
        const target = focusEl || overlay.querySelector('.modal-close, button, [tabindex]');
        if (target && typeof target.focus === 'function') setTimeout(() => target.focus(), 30);
    }

    /** Close a .modal-overlay and return focus to what opened it (no-op when not open). */
    _closeOverlay(overlay) {
        if (!overlay || !overlay.classList.contains('active')) return;
        overlay.classList.remove('active');
        if (overlay.open) overlay.close();
        const back = overlay._returnFocus;
        overlay._returnFocus = null;
        if (back && document.body.contains(back) && typeof back.focus === 'function') back.focus();
    }

    /**
     * Execute the pending assignment
     */
    async executeAssignment() {
        if (!this.pendingAssignment) return;

        const { account, repName } = this.pendingAssignment;

        // Disable button while processing
        if (this.elements.confirmSubmit) {
            this.elements.confirmSubmit.disabled = true;
            this.elements.confirmSubmit.innerHTML = '<span class="loading-spinner"></span> Assigning...';
        }

        try {
            await this.service.assignToRep(account, repName);

            // Audit trail + ShopWorks To-Do entry (there's no write-back — Erik
            // must key this into ShopWorks; the to-do tracks it until the ODBC
            // mirror confirms). CRM_MANUAL = card-assign, vs RECONCILE modal.
            await this.logAssignmentHistory({
                ID_Customer: account.ID_Customer,
                companyName: account.CompanyName,
                shopWorksRep: account.Assigned_To || 'House',
            }, repName === 'Taneisha' ? 'Taneisha Clark' : 'Nika Lao', 'CRM_MANUAL');

            // Success
            this.closeConfirmModal();
            this.showToast(`${account.CompanyName} assigned to ${repName}! Added to the ShopWorks To-Do — key it into ShopWorks when you can.`);
            this.refreshShopWorksTodoCount();

            // Reload data
            await this.loadData();

        } catch (error) {
            this.showError(`Failed to assign account: ${error.message}`);
        } finally {
            if (this.elements.confirmSubmit) {
                this.elements.confirmSubmit.disabled = false;
            }
        }
    }

    /**
     * Show success toast
     */
    showToast(message) {
        if (!this.elements.celebrationToast) return;

        this.elements.celebrationToast.textContent = message;
        this.elements.celebrationToast.classList.add('show');

        setTimeout(() => {
            this.elements.celebrationToast.classList.remove('show');
        }, 4000);
    }

    /**
     * Show error banner
     */
    showError(message, retryable) {
        const dialog = Array.from(document.querySelectorAll('dialog[open]')).pop();
        if (dialog) {
            let notice = dialog.querySelector('.crm-modal-error');
            if (!notice) {
                notice = document.createElement('p');
                notice.className = 'crm-modal-error';
                notice.setAttribute('role', 'alert');
                (dialog.querySelector('.modal-body, .reconcile-modal-body, .gap-report-modal-body, .account-detail-modal-body') || dialog).prepend(notice);
            }
            notice.textContent = message;
        }
        if (this.elements.errorBanner && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            if (this.elements.errorRetry) this.elements.errorRetry.hidden = !retryable;
            this.elements.errorBanner.classList.add('show');
        }
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.toggle('show', show);
        }
    }

    // ============================================================
    // SYNC CONTROLS (Erik's Control Center)
    // ============================================================

    /**
     * Sync all CRM dashboards (Nika, Taneisha, House)
     * Runs ownership sync first, then sales sync
     */
    async syncAllCRM() {
        const btn = this.elements.syncAllBtn;
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Syncing All...';

        try {
            const results = { success: [], failed: [] };

            // Phase 1: Ownership sync for Nika and Taneisha
            this.showToast('Syncing account ownership...');

            const ownershipEndpoints = [
                { name: 'Nika Ownership', url: '/api/crm-proxy/nika-accounts/sync-ownership' },
                { name: 'Taneisha Ownership', url: '/api/crm-proxy/taneisha-accounts/sync-ownership' }
            ];

            for (const endpoint of ownershipEndpoints) {
                try {
                    const response = await fetch(endpoint.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin'
                    });
                    if (response.ok) {
                        results.success.push(endpoint.name);
                    } else {
                        results.failed.push(endpoint.name);
                    }
                } catch (e) {
                    results.failed.push(endpoint.name);
                }
            }

            // Phase 2: Sales sync for all dashboards
            btn.innerHTML = '<span class="loading-spinner"></span> Syncing Sales...';
            this.showToast('Syncing sales data...');

            const salesEndpoints = [
                { name: 'Nika Sales', url: '/api/crm-proxy/nika-accounts/sync-sales' },
                { name: 'Taneisha Sales', url: '/api/crm-proxy/taneisha-accounts/sync-sales' },
                { name: 'House Sales', url: '/api/crm-proxy/house-accounts/sync-sales' }
            ];

            for (const endpoint of salesEndpoints) {
                try {
                    const response = await fetch(endpoint.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin'
                    });
                    if (response.ok) {
                        results.success.push(endpoint.name);
                    } else {
                        results.failed.push(endpoint.name);
                    }
                } catch (e) {
                    results.failed.push(endpoint.name);
                }
            }

            // Show results
            if (results.failed.length === 0) {
                this.showToast(`All CRM dashboards synced! (${results.success.length} operations)`);
            } else {
                this.showError(`Sync completed with errors: ${results.failed.join(', ')}`);
            }

            // Wait for Caspio rate limit window to reset before fetching data
            // Sync operations make many Caspio API calls - need longer delay to avoid 429
            this.showToast('Waiting for data to settle (10s)...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Reload House dashboard data
            await this.loadData();

            // Force "Just now" status - don't wait for Caspio API eventual consistency
            this.renderSyncStatus({
                nika: { lastSync: new Date(), status: 'fresh' },
                taneisha: { lastSync: new Date(), status: 'fresh' }
            });

        } catch (error) {
            console.error('Sync all CRM error:', error);
            this.showError('Failed to sync CRM dashboards. Please try again.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    /**
     * Quick sync House accounts only
     */
    async syncHouseOnly() {
        const btn = this.elements.syncHouseBtn;
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Syncing...';

        try {
            const response = await fetch('/api/crm-proxy/house-accounts/sync-sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast(`House accounts synced! YTD: $${(result.totalYtd || 0).toLocaleString()}`);
                await this.loadData();
                await this.loadSyncStatus();
            } else {
                throw new Error('Sync failed');
            }

        } catch (error) {
            console.error('Sync House error:', error);
            this.showError('Failed to sync House accounts. Please try again.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    // ============================================================
    // SYNC STATUS INDICATOR
    // ============================================================

    /**
     * Fetch last sync dates for all CRM dashboards
     * Queries each rep's accounts to find the most recent Last_Sync_Date
     */
    async fetchSyncStatus() {
        const status = {
            nika: { lastSync: null, status: 'unknown' },
            taneisha: { lastSync: null, status: 'unknown' }
        };

        // Fetch accounts sorted by Last_Sync_Date DESC to get most recently synced first
        // House excluded - table doesn't have Last_Sync_Date field
        const endpoints = [
            { key: 'nika', url: '/api/crm-proxy/nika-accounts?orderBy=Last_Sync_Date&orderDir=DESC' },
            { key: 'taneisha', url: '/api/crm-proxy/taneisha-accounts?orderBy=Last_Sync_Date&orderDir=DESC' }
        ];

        // Fetch in parallel
        await Promise.all(endpoints.map(async ({ key, url }) => {
            try {
                const response = await fetch(url, { credentials: 'same-origin' });
                if (response.ok) {
                    const data = await response.json();
                    const accounts = data.Result || data.accounts || [];

                    // Find the most recent Last_Sync_Date
                    let latestSync = null;
                    accounts.forEach(acc => {
                        // Caspio Last_Sync_Date is Pacific wall-clock — resolve via shared helper.
                        const syncDate = acc.Last_Sync_Date ? (window.CaspioDate ? window.CaspioDate.parse(acc.Last_Sync_Date) : new Date(acc.Last_Sync_Date)) : null;
                        if (syncDate && (!latestSync || syncDate > latestSync)) {
                            latestSync = syncDate;
                        }
                    });

                    if (latestSync) {
                        const hoursSince = (Date.now() - latestSync.getTime()) / (1000 * 60 * 60);
                        status[key] = {
                            lastSync: latestSync,
                            hoursSince: hoursSince,
                            status: hoursSince < 12 ? 'fresh' : (hoursSince < 24 ? 'stale' : 'critical')
                        };
                    }
                }
            } catch (e) {
                console.warn(`Could not fetch sync status for ${key}:`, e.message);
            }
        }));

        return status;
    }

    /**
     * Render sync status badges in the UI
     */
    renderSyncStatus(status) {
        const container = document.getElementById('sync-status');
        if (!container) return;

        const formatTime = (date) => {
            if (!date) return 'Never';
            const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
            if (hours < 1) return 'Just now';
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        };

        const getIcon = (status) => {
            switch (status) {
                case 'fresh': return '<i class="fas fa-check" aria-hidden="true"></i>';
                case 'stale': return '<i class="fas fa-exclamation" aria-hidden="true"></i>';
                case 'critical': return '<i class="fas fa-times" aria-hidden="true"></i>';
                default: return '<i class="fas fa-question" aria-hidden="true"></i>';
            }
        };

        // Only show Nika and Taneisha - House_Accounts table doesn't have Last_Sync_Date field
        const reps = [
            { key: 'nika', name: 'Nika' },
            { key: 'taneisha', name: 'Taneisha' }
        ];

        container.innerHTML = reps.map(({ key, name }) => {
            const s = status[key];
            return `
                <div class="sync-status-item">
                    <span class="rep-name">${name}:</span>
                    <span class="sync-time">${formatTime(s.lastSync)}</span>
                    <span class="status-badge ${s.status}" title="${s.status === 'fresh' ? 'Synced recently' : s.status === 'stale' ? 'Getting stale' : 'Needs sync'}">${getIcon(s.status)}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Load and display sync status
     */
    async loadSyncStatus() {
        try {
            const status = await this.fetchSyncStatus();
            this.renderSyncStatus(status);
        } catch (e) {
            console.warn('Could not load sync status:', e.message);
        }
    }

    // ============================================================
    // RECONCILE MODAL METHODS
    // ============================================================

    /**
     * Open reconcile modal and fetch unassigned customers
     */
    async openReconcileModal() {
        this._openOverlay(this.elements.reconcileModalOverlay, this.elements.reconcileModalClose);
        if (this.elements.reconcileLoading) {
            this.elements.reconcileLoading.hidden = false;
            this.elements.reconcileLoading.innerHTML = '<span class="loading-spinner"></span> Loading unassigned customers...';
        }
        if (this.elements.reconcileResults) {
            this.elements.reconcileResults.hidden = true;
        }
        if (this.elements.reconcileFooter) {
            this.elements.reconcileFooter.hidden = true;
        }

        try {
            // Step 1: Fetch unassigned customers from ManageOrders
            const result = await this.service.reconcileAccounts(false);
            const missingCustomers = result.missingCustomers || [];

            // Step 2: Fetch ShopWorks rep data for each customer
            const customerIds = missingCustomers.map(c => c.ID_Customer);

            if (missingCustomers.length > 0 && this.elements.reconcileLoading) {
                this.elements.reconcileLoading.innerHTML = `<span class="loading-spinner"></span> Cross-referencing ${customerIds.length} customers with ShopWorks...`;
            }

            const shopWorksData = await this.service.fetchShopWorksRepsBatch(customerIds);

            // Merge ShopWorks data into results
            missingCustomers.forEach(customer => {
                const customerId = customer.ID_Customer;
                const swData = shopWorksData.get(customerId);

                // Check if we have valid record data (not null, notFound, or rateLimited)
                if (swData && !swData.notFound && !swData.rateLimited && swData.CustomerServiceRep !== undefined) {
                    customer.shopWorksRep = swData.CustomerServiceRep || '';
                    customer.shopWorksTier = swData.Account_Tier || '';
                    customer.inShopWorks = true;
                } else {
                    customer.shopWorksRep = null;
                    customer.shopWorksTier = null;
                    customer.inShopWorks = false;
                }
            });

            // Store for assignment modal
            this.missingCustomersCache = missingCustomers;

            this.displayReconcileResults({ ...result, missingCustomers });
        } catch (error) {
            console.error('Reconcile error:', error);
            this.showError('Failed to check for unassigned customers. Please try again.');
            this.closeReconcileModal();
        }
    }

    /**
     * Close reconcile modal
     */
    closeReconcileModal() {
        this._closeOverlay(this.elements.reconcileModalOverlay);
    }

    /**
     * Refresh reconcile data (re-fetch from API without closing modal)
     */
    async refreshReconcileData() {
        // Add spinning animation to refresh button
        if (this.elements.reconcileRefreshBtn) {
            this.elements.reconcileRefreshBtn.classList.add('spinning');
            this.elements.reconcileRefreshBtn.disabled = true;
        }

        try {
            housaccoLog('[Reconcile] Refreshing data from Caspio...');
            await this.openReconcileModal();
        } finally {
            // Remove spinning animation
            if (this.elements.reconcileRefreshBtn) {
                this.elements.reconcileRefreshBtn.classList.remove('spinning');
                this.elements.reconcileRefreshBtn.disabled = false;
            }
        }
    }

    /**
     * Display reconcile results in the modal
     */
    displayReconcileResults(result) {
        if (this.elements.reconcileLoading) {
            this.elements.reconcileLoading.hidden = true;
        }
        if (this.elements.reconcileResults) {
            this.elements.reconcileResults.hidden = false;
        }

        const missingCustomers = result.missingCustomers || [];

        if (missingCustomers.length === 0) {
            if (this.elements.reconcileEmpty) {
                this.elements.reconcileEmpty.hidden = false;
            }
            if (this.elements.reconcileSummary) {
                this.elements.reconcileSummary.hidden = true;
            }
            if (this.elements.reconcileTableBody) {
                this.elements.reconcileTableBody.parentElement.parentElement.hidden = true;
            }
            if (this.elements.reconcileFooter) {
                this.elements.reconcileFooter.hidden = false;
            }
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.hidden = true;
            }
            return;
        }

        if (this.elements.reconcileEmpty) {
            this.elements.reconcileEmpty.hidden = true;
        }
        if (this.elements.reconcileSummary) {
            this.elements.reconcileSummary.hidden = false;
        }

        if (this.elements.reconcileSummary) {
            const totalSales = missingCustomers.reduce((sum, c) => sum + (parseFloat(c.totalSales) || 0), 0);
            const totalOrders = missingCustomers.reduce((sum, c) => sum + (parseInt(c.orderCount) || 0), 0);

            this.elements.reconcileSummary.innerHTML = `
                <div class="reconcile-summary-stat">
                    <div class="stat-value">${missingCustomers.length}</div>
                    <div class="stat-label">Unassigned Customers</div>
                </div>
                <div class="reconcile-summary-stat">
                    <div class="stat-value">${totalOrders}</div>
                    <div class="stat-label">Total Orders</div>
                </div>
                <div class="reconcile-summary-stat">
                    <div class="stat-value">${this.formatCurrency(totalSales)}</div>
                    <div class="stat-label">Total Sales</div>
                </div>
            `;
        }

        if (this.elements.reconcileTableBody) {
            this.elements.reconcileTableBody.parentElement.parentElement.hidden = false;
            this.elements.reconcileTableBody.innerHTML = missingCustomers.map(customer => {
                // Determine match status for indicators
                const orderRep = (customer.rep || '').toLowerCase().trim();
                const swRep = (customer.shopWorksRep || '').toLowerCase().trim();
                const repsMatch = orderRep && swRep && (orderRep.includes(swRep.split(' ')[0]) || swRep.includes(orderRep.split(' ')[0]));

                // Build ShopWorks Rep cell with status indicator
                let swRepCell = '';
                if (!customer.inShopWorks) {
                    swRepCell = '<span class="sw-status sw-not-found"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not in SW</span>';
                } else if (repsMatch) {
                    swRepCell = `<span class="sw-status sw-match"><i class="fas fa-check" aria-hidden="true"></i> ${this.escapeHtml(customer.shopWorksRep)}</span>`;
                } else {
                    swRepCell = `<span class="sw-status sw-mismatch"><i class="fas fa-exchange-alt" aria-hidden="true"></i> ${this.escapeHtml(customer.shopWorksRep || 'House')}</span>`;
                }

                // Format tier display
                const tierDisplay = customer.shopWorksTier
                    ? this.escapeHtml(customer.shopWorksTier.replace(/'26|'26-|'26 -/g, '').trim())
                    : '-';

                // Build order details row (expandable)
                const ordersHtml = (customer.orders && customer.orders.length > 0)
                    ? customer.orders.map(order => `
                        <div class="order-item">
                            <span class="order-number">#${this.escapeHtml(order.orderNumber || 'N/A')}</span>
                            <span class="order-amount">${this.formatCurrency(order.amount || 0)}</span>
                            <span class="order-date">${this.formatDate(order.date)}</span>
                        </div>
                    `).join('')
                    : '<div class="order-item">No order details available</div>';

                return `
                <tr class="customer-row" data-customer-id="${customer.ID_Customer}" data-company-name="${this.escapeHtml(customer.companyName || '')}" data-call="houseController.toggleOrderDetails" data-args='["$this", "$event"]'>
                    <td class="expand-toggle"><button type="button" class="btn order-disclosure" aria-expanded="false" aria-label="Show orders for ${this.escapeHtml(customer.companyName || ('ID ' + customer.ID_Customer))}"><i class="fas fa-chevron-right" aria-hidden="true"></i></button></td>
                    <td class="company-name ${!customer.companyName || customer.companyName.startsWith('ID:') ? 'unknown-company' : ''}">
                        ${this.escapeHtml(customer.companyName || `ID: ${customer.ID_Customer}`)}
                        <div class="customer-id">(ID: ${customer.ID_Customer})</div>
                    </td>
                    <td class="rep-name order-rep">${this.escapeHtml(customer.rep || '-')}</td>
                    <td class="rep-name sw-rep">${swRepCell}</td>
                    <td class="tier-name">${tierDisplay}</td>
                    <td class="order-count">${customer.orderCount || 0}</td>
                    <td class="sales-amount">${this.formatCurrency(customer.totalSales || 0)}</td>
                    <td class="last-order">${this.formatDate(customer.lastOrderDate)}</td>
                    <td class="actions">
                        <select class="assign-dropdown field-select" aria-label="Assign ${this.escapeHtml(customer.companyName || ('ID ' + customer.ID_Customer))} to" data-change="houseController.quickAssignFromSelect" data-change-args='["$this"]' data-stop="1">
                            <option value="">Assign to...</option>
                            <option value="Taneisha Clark">Taneisha Clark</option>
                            <option value="Nika Lao">Nika Lao</option>
                            <option value="House">House</option>
                            <option value="Ruthie Nhoung">Ruthie Nhoung</option>
                            <option value="Erik Mickelson">Erik Mickelson</option>
                            <option value="Jim Mickelson">Jim Mickelson</option>
                        </select>
                    </td>
                </tr>
                <tr class="order-details-row" hidden>
                    <td colspan="9">
                        <div class="order-list">
                            <div class="order-list-header">Orders for this customer:</div>
                            ${ordersHtml}
                        </div>
                    </td>
                </tr>
            `;
            }).join('');
        }

        if (this.elements.reconcileFooter) {
            this.elements.reconcileFooter.hidden = false;
        }
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.hidden = false;
            this.elements.reconcileAddAll.disabled = false;
            this.elements.reconcileAddAll.innerHTML = `<i class="fas fa-plus" aria-hidden="true"></i> Add All ${missingCustomers.length} to House`;
        }
    }

    /**
     * Add all missing customers to House Accounts
     */
    async addAllMissingCustomers() {
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.disabled = true;
            this.elements.reconcileAddAll.innerHTML = '<span class="loading-spinner"></span> Adding...';
        }

        try {
            const result = await this.service.reconcileAccounts(true);

            const addedCount = result.addedCount || 0;
            this.showToast(`Added ${addedCount} customers to House Accounts!`);

            this.closeReconcileModal();
            await this.loadData();

        } catch (error) {
            this.showError('Failed to add customers. Please try again.');
        } finally {
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.disabled = false;
                this.elements.reconcileAddAll.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Add All to House';
            }
        }
    }

    // ============================================================
    // SHOPWORKS TO-DO (no write-back — manual keying checklist)
    // ============================================================

    escHtml(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async fetchShopWorksTodo() {
        const resp = await fetch('/api/crm-proxy/assignment-history/shopworks-todo', { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    }

    /** Badge on the button — quiet best-effort (modal open is the loud path). */
    async refreshShopWorksTodoCount() {
        try {
            const todo = await this.fetchShopWorksTodo();
            const n = (todo.pending || []).length + (todo.reverted || []).length;
            this._swTodoCache = todo;
            if (this.elements.swTodoCount) {
                this.elements.swTodoCount.hidden = n === 0;
                this.elements.swTodoCount.textContent = n;
            }
        } catch (e) {
            console.warn('ShopWorks to-do count failed:', e.message);
        }
    }

    closeShopWorksTodoModal() {
        this._closeOverlay(this.elements.swTodoOverlay);
    }

    async openShopWorksTodoModal() {
        this._openOverlay(this.elements.swTodoOverlay, this.elements.swTodoClose);
        this.elements.swTodoBody.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const todo = await this.fetchShopWorksTodo();
            this._swTodoCache = todo;
            this.renderShopWorksTodo(todo);
            this.refreshShopWorksTodoCount();
        } catch (e) {
            this.elements.swTodoBody.innerHTML =
                `<div class="empty-state"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i><h3>Could not load the to-do list</h3><p>${this.escHtml(e.message)} — close and retry.</p></div>`;
        }
    }

    renderShopWorksTodo(todo) {
        const pending = todo.pending || [];
        const reverted = todo.reverted || [];
        if (!pending.length && !reverted.length) {
            this.elements.swTodoBody.innerHTML =
                '<div class="empty-state"><i class="fas fa-circle-check" aria-hidden="true"></i><h3>All caught up</h3><p>Every dashboard assignment has been confirmed in ShopWorks.</p></div>';
            return;
        }
        const esc = (v) => this.escHtml(v);
        const fmtDay = (d) => { const x = HouseAccountsController.parseCalendarDate(d); return x ? x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; };
        let html = '';
        if (reverted.length) {
            html += '<h3 class="sw-todo-section sw-todo-section--warn"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ShopWorks disagreed — re-key or accept</h3>' +
                '<table class="sw-todo-table data-table"><thead><tr><th>Cust #</th><th>Company</th><th>What happened</th><th></th></tr></thead><tbody>' +
                reverted.map((r) => `<tr><td>${esc(r.customerId)}</td><td>${esc(r.customerName)}</td><td>${esc(r.notes)}</td>` +
                    `<td><button class="sync-btn sw-todo-dismiss btn" data-cid="${esc(r.customerId)}" data-cname="${esc(r.customerName)}" data-rep="${esc(r.newRep)}">Accept</button></td></tr>`).join('') +
                '</tbody></table>';
        }
        if (pending.length) {
            html += '<h3 class="sw-todo-section"><i class="fas fa-keyboard" aria-hidden="true"></i> Key these into ShopWorks (Cust → Customer Service Rep)</h3>' +
                '<table class="sw-todo-table data-table"><thead><tr><th>Cust #</th><th>Company</th><th>Set rep to</th><th>Assigned</th><th></th></tr></thead><tbody>' +
                pending.map((p) => `<tr><td>${esc(p.customerId)}</td><td>${esc(p.customerName)}</td><td><strong>${esc(p.newRep)}</strong></td><td>${fmtDay(p.actionDate)}</td>` +
                    `<td><button class="sync-btn sw-todo-dismiss btn" data-cid="${esc(p.customerId)}" data-cname="${esc(p.customerName)}" data-rep="${esc(p.newRep)}">Mark done</button></td></tr>`).join('') +
                '</tbody></table>' +
                '<p class="modal-subtitle">Rows also clear automatically ~15 min after you key them in (the ODBC mirror confirms the match).</p>';
        }
        this.elements.swTodoBody.innerHTML = html;
        this.elements.swTodoBody.querySelectorAll('.sw-todo-dismiss').forEach((btn) => {
            btn.addEventListener('click', () => this.dismissShopWorksTodoItem(btn));
        });
    }

    /** "Mark done"/"Accept" — logs a SYNC row so the item clears immediately. */
    async dismissShopWorksTodoItem(btn) {
        btn.disabled = true;
        try {
            const resp = await fetch('/api/crm-proxy/assignment-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    customerId: btn.dataset.cid,
                    customerName: btn.dataset.cname,
                    previousRep: btn.dataset.rep,
                    newRep: btn.dataset.rep,
                    actionType: 'REASSIGNED',
                    changedBy: this.staffName || 'Erik',
                    changeSource: 'SYNC',
                    notes: 'Manually marked done on the house page',
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            btn.closest('tr').remove();
            this.refreshShopWorksTodoCount();
        } catch (e) {
            btn.disabled = false;
            this.showError(`Could not mark done: ${e.message}`);
        }
    }

    copyShopWorksTodo() {
        const pending = (this._swTodoCache && this._swTodoCache.pending) || [];
        if (!pending.length) { this.showToast('Nothing pending to copy.'); return; }
        const lines = pending.map((p) => `Cust #${p.customerId}  ${p.customerName}  →  ${p.newRep}`);
        navigator.clipboard.writeText('ShopWorks rep updates needed:\n' + lines.join('\n'))
            .then(() => this.showToast(`Copied ${pending.length} item${pending.length === 1 ? '' : 's'}.`))
            .catch(() => this.showError('Copy failed — select the table text manually.'));
    }

    // ============================================================
    // GAP REPORT MODAL METHODS
    // ============================================================

    /**
     * Open gap report modal and fetch full reconciliation data
     */
    async openGapReportModal() {
        this._openOverlay(this.elements.gapReportModalOverlay, this.elements.gapReportModalClose);
        if (this.elements.gapReportLoading) {
            this.elements.gapReportLoading.hidden = false;
        }
        if (this.elements.gapReportContent) {
            this.elements.gapReportContent.hidden = true;
        }

        try {
            const result = await this.service.fetchFullReconciliation();
            this.displayGapReport(result);
        } catch (error) {
            console.error('Gap report error:', error);
            if (this.elements.gapReportLoading) this.elements.gapReportLoading.hidden = true;
            this.showError('Failed to load gap report. Use Refresh to try again.');
        }
    }

    /**
     * Close gap report modal
     */
    closeGapReportModal() {
        this._closeOverlay(this.elements.gapReportModalOverlay);
    }

    /**
     * Refresh gap report data
     */
    async refreshGapReport() {
        if (this.elements.gapReportRefreshBtn) {
            this.elements.gapReportRefreshBtn.classList.add('spinning');
            this.elements.gapReportRefreshBtn.disabled = true;
        }

        try {
            await this.openGapReportModal();
        } finally {
            if (this.elements.gapReportRefreshBtn) {
                this.elements.gapReportRefreshBtn.classList.remove('spinning');
                this.elements.gapReportRefreshBtn.disabled = false;
            }
        }
    }

    /**
     * Display gap report results
     * @param {Object} result - Full reconciliation data from API
     */
    displayGapReport(result) {
        if (this.elements.gapReportLoading) {
            this.elements.gapReportLoading.hidden = true;
        }
        if (this.elements.gapReportContent) {
            this.elements.gapReportContent.hidden = false;
        }

        const reps = result.reps || [];
        const totalConflicts = reps.reduce((sum, r) => sum + r.conflictCount, 0);
        const totalAmount = reps.reduce((sum, r) => sum + r.totalAmount, 0);

        if (totalConflicts === 0) {
            this.elements.gapReportContent.innerHTML = `
                <div class="gap-report-empty">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <h3>No Authority Conflicts!</h3>
                    <p>All orders match their CRM owners. Great job keeping things in sync!</p>
                </div>
            `;
            return;
        }

        // Build report HTML
        let html = `
            <div class="gap-report-summary">
                <div class="gap-stat">
                    <div class="gap-stat-value">${totalConflicts}</div>
                    <div class="gap-stat-label">Total Conflicts</div>
                </div>
                <div class="gap-stat">
                    <div class="gap-stat-value">${this.formatCurrency(totalAmount)}</div>
                    <div class="gap-stat-label">Total Amount</div>
                </div>
                <div class="gap-stat">
                    <div class="gap-stat-value">${result.ordersPeriod || '60 days'}</div>
                    <div class="gap-stat-label">Period</div>
                </div>
            </div>
        `;

        // Render each rep's conflicts
        reps.forEach(rep => {
            if (rep.conflictCount === 0) return;

            const repInitials = rep.rep.split(' ').map(n => n[0]).join('');

            html += `
                <div class="gap-rep-section">
                    <div class="gap-rep-header" data-call="houseController.toggleGapRepSection" data-args='["$this"]' role="button" tabindex="0" aria-expanded="true">
                        <div class="gap-rep-info">
                            <span class="gap-rep-avatar">${repInitials}</span>
                            <span class="gap-rep-name">${this.escapeHtml(rep.rep)}</span>
                        </div>
                        <div class="gap-rep-stats">
                            <span class="gap-conflict-count">${rep.conflictCount} conflicts</span>
                            <span class="gap-conflict-amount">${this.formatCurrency(rep.totalAmount)}</span>
                            <i class="fas fa-chevron-down" aria-hidden="true"></i>
                        </div>
                    </div>
                    <div class="gap-rep-conflicts">
                        ${rep.outboundCount > 0 ? `
                            <div class="gap-conflict-group">
                                <div class="gap-group-header outbound">
                                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                                    Outbound: ${rep.outboundCount} customers (${this.formatCurrency(rep.outboundAmount)})
                                    <span class="gap-group-hint">Orders BY ${rep.rep.split(' ')[0]} for customers NOT in their CRM</span>
                                </div>
                                ${this.renderGapConflicts(rep.conflicts.filter(c => c.conflictType === 'outbound'), rep.rep)}
                            </div>
                        ` : ''}
                        ${rep.inboundCount > 0 ? `
                            <div class="gap-conflict-group">
                                <div class="gap-group-header inbound">
                                    <i class="fas fa-arrow-left" aria-hidden="true"></i>
                                    Inbound: ${rep.inboundCount} customers (${this.formatCurrency(rep.inboundAmount)})
                                    <span class="gap-group-hint">Orders by OTHER reps for customers IN ${rep.rep.split(' ')[0]}'s CRM</span>
                                </div>
                                ${this.renderGapConflicts(rep.conflicts.filter(c => c.conflictType === 'inbound'), rep.rep)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="gap-report-footer">
                <i class="fas fa-info-circle" aria-hidden="true"></i>
                To fix: Change order rep in ShopWorks OR add/move customer in CRM.
                Report generated: ${new Date(result.generatedAt).toLocaleString()}
            </div>
        `;

        this.elements.gapReportContent.innerHTML = html;
    }

    /**
     * Render gap conflicts table for a rep
     */
    renderGapConflicts(conflicts, repName) {
        if (!conflicts || conflicts.length === 0) return '';

        return `
            <table class="gap-conflicts-table data-table">
                <thead>
                    <tr>
                        <th class="expand-col"></th>
                        <th>Customer</th>
                        <th>CRM Owner</th>
                        <th>Order Writer(s)</th>
                        <th>Orders</th>
                        <th>Amount</th>
                        <th>Fix</th>
                    </tr>
                </thead>
                <tbody>
                    ${conflicts.map(c => this.renderGapConflictRow(c, repName)).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Render a single conflict row
     */
    renderGapConflictRow(conflict, repName) {
        const isOutbound = conflict.conflictType === 'outbound';
        const writers = conflict.repNames && conflict.repNames.length > 0
            ? conflict.repNames.join(', ')
            : repName;

        // Build fix instruction based on conflict type
        let fixInstruction;
        if (isOutbound) {
            fixInstruction = conflict.owner
                ? `Add to ${repName.split(' ')[0]}'s CRM<br><em>OR</em> change orders to "${conflict.owner}"`
                : `Add to ${repName.split(' ')[0]}'s CRM<br><em>OR</em> assign customer in ShopWorks`;
        } else {
            fixInstruction = `Change orders from "${writers}" to "${repName}" in ShopWorks`;
        }

        // Build orders list
        const ordersHtml = (conflict.orders || []).map(o => `
            <div class="gap-order-item">
                <span class="gap-order-number">#${this.escapeHtml(o.orderNumber || 'N/A')}</span>
                <span class="gap-order-amount">${this.formatCurrency(o.amount || 0)}</span>
                <span class="gap-order-date">${this.formatDate(o.date)}</span>
                ${o.writer ? `<span class="gap-order-writer">by ${this.escapeHtml(o.writer)}</span>` : ''}
            </div>
        `).join('');

        return `
            <tr class="gap-conflict-row" data-call="houseController.toggleGapOrderDetails" data-args='["$this"]'>
                <td class="expand-toggle"><button type="button" class="btn order-disclosure" aria-expanded="false" aria-label="Show orders for ${this.escapeHtml(conflict.companyName || ('ID ' + conflict.ID_Customer))}"><i class="fas fa-chevron-right" aria-hidden="true"></i></button></td>
                <td class="gap-company">
                    ${this.escapeHtml(conflict.companyName || `ID: ${conflict.ID_Customer}`)}
                    <div class="gap-customer-id">ID: ${conflict.ID_Customer}</div>
                </td>
                <td class="gap-owner">${this.escapeHtml(conflict.owner || 'Unassigned')}</td>
                <td class="gap-writers">${this.escapeHtml(writers)}</td>
                <td class="gap-order-count">${conflict.orderCount || 0}</td>
                <td class="gap-amount">${this.formatCurrency(conflict.totalSales || 0)}</td>
                <td class="gap-fix">${fixInstruction}</td>
            </tr>
            <tr class="gap-orders-row" hidden>
                <td colspan="7">
                    <div class="gap-order-list">
                        <div class="gap-order-list-header">Orders to fix:</div>
                        ${ordersHtml}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Toggle gap report rep section expansion
     */
    toggleGapRepSection(header) {
        const conflictsDiv = header.nextElementSibling;
        const icon = header.querySelector('.fa-chevron-down, .fa-chevron-up');

        if (conflictsDiv) {
            const isHidden = conflictsDiv.hidden;
            conflictsDiv.hidden = !isHidden;
            header.setAttribute('aria-expanded', isHidden ? 'true' : 'false');

            if (icon) {
                icon.classList.toggle('fa-chevron-down', !isHidden);
                icon.classList.toggle('fa-chevron-up', isHidden);
            }
        }
    }

    /**
     * Toggle gap order details row
     */
    toggleGapOrderDetails(row) {
        const detailsRow = row.nextElementSibling;
        const icon = row.querySelector('.expand-toggle i');

        if (detailsRow && detailsRow.classList.contains('gap-orders-row')) {
            const isHidden = detailsRow.hidden;
            detailsRow.hidden = !isHidden;
            row.querySelector('.order-disclosure').setAttribute('aria-expanded', isHidden ? 'true' : 'false');

            if (icon) {
                icon.classList.toggle('fa-chevron-right', !isHidden);
                icon.classList.toggle('fa-chevron-down', isHidden);
            }
        }
    }

    // ============================================================
    // ENHANCED ASSIGNMENT FROM RECONCILE MODAL
    // ============================================================

    /**
     * Open assignment modal for a customer from reconcile list
     * @param {number} customerId - The customer ID to assign
     */
    openAssignFromReconcile(customerId) {
        // Find customer in cached data
        const customer = (this.missingCustomersCache || []).find(c => c.ID_Customer === customerId);
        if (!customer) {
            this.showError('Customer not found. Please refresh and try again.');
            return;
        }

        // Store for assignment
        this.pendingReconcileAssignment = customer;

        // Build tier options based on rep selection
        const tierOptions = this.buildTierOptions('Taneisha'); // Default

        // Create and show modal
        const modalHtml = `
            <dialog class="modal-overlay active" id="assign-modal-overlay" aria-labelledby="assign-modal-title">
                <div class="modal-content modal-content--narrow">
                    <div class="modal-header">
                        <h2 id="assign-modal-title">Assign Customer</h2>
                        <button type="button" class="close-btn btn" aria-label="Close" data-call="houseController.closeAssignModal">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="assign-modal-content">
                            <div class="assign-customer-info">
                                <div class="info-row">
                                    <span class="info-label">Company</span>
                                    <span class="info-value">${this.escapeHtml(customer.companyName || `ID: ${customer.ID_Customer}`)}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Order Rep</span>
                                    <span class="info-value">${this.escapeHtml(customer.rep || '-')}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">ShopWorks Rep</span>
                                    <span class="info-value ${customer.inShopWorks ? '' : 'sw-not-found'}">${customer.inShopWorks ? this.escapeHtml(customer.shopWorksRep || 'House') : 'Not in ShopWorks'}</span>
                                </div>
                                ${customer.shopWorksTier ? `
                                <div class="info-row">
                                    <span class="info-label">Current Tier</span>
                                    <span class="info-value">${this.escapeHtml(customer.shopWorksTier)}</span>
                                </div>
                                ` : ''}
                            </div>

                            <div class="assign-rep-buttons">
                                <button type="button" class="btn-assign-rep taneisha btn" data-rep="Taneisha" aria-pressed="false" data-call="houseController.selectAssignRep" data-args='["Taneisha"]'>
                                    <i class="fas fa-user" aria-hidden="true"></i> Taneisha
                                </button>
                                <button type="button" class="btn-assign-rep nika btn" data-rep="Nika" aria-pressed="false" data-call="houseController.selectAssignRep" data-args='["Nika"]'>
                                    <i class="fas fa-user" aria-hidden="true"></i> Nika
                                </button>
                                <button type="button" class="btn-assign-rep house btn" data-rep="House" aria-pressed="false" data-call="houseController.selectAssignRep" data-args='["House"]'>
                                    <i class="fas fa-building" aria-hidden="true"></i> House
                                </button>
                            </div>

                            <div class="tier-select-group">
                                <label for="tier-select">Account Tier</label>
                                <select id="tier-select" class="tier-select field-select">
                                    ${tierOptions}
                                </select>
                            </div>

                            <div class="sync-checkbox-group">
                                <input type="checkbox" id="sync-shopworks" checked>
                                <label for="sync-shopworks">Also update ShopWorks (Sales_Reps_2026)</label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel btn" data-call="houseController.closeAssignModal">Cancel</button>
                        <button type="button" class="btn-save btn" id="confirm-assign-btn" data-call="houseController.confirmAssignFromReconcile">
                            <i class="fas fa-check" aria-hidden="true"></i> Assign
                        </button>
                    </div>
                </div>
            </dialog>
        `;

        // Add modal to page (remember the opener so Close returns focus)
        this._assignReturnFocus = document.activeElement;
        const container = document.createElement('div');
        container.id = 'assign-modal-container';
        container.innerHTML = modalHtml;
        document.body.appendChild(container);
        container.querySelector('dialog').showModal();
        const firstRep = container.querySelector('.btn-assign-rep');
        if (firstRep) setTimeout(() => firstRep.focus(), 30);

        // Pre-select rep based on ShopWorks or Order rep
        const suggestedRep = this.suggestRep(customer);
        if (suggestedRep) {
            this.selectAssignRep(suggestedRep);
        }
    }

    /**
     * Toggle order details row expansion
     * @param {HTMLElement} row - The customer row that was clicked
     * @param {Event} event - The click event
     */
    toggleOrderDetails(row, event) {
        // Don't toggle if clicking on dropdown or other interactive elements
        if (event.target.closest('.assign-dropdown') || event.target.closest('select')) {
            return;
        }

        const detailsRow = row.nextElementSibling;
        const icon = row.querySelector('.expand-toggle i');

        if (detailsRow && detailsRow.classList.contains('order-details-row')) {
            const isHidden = detailsRow.hidden;
            detailsRow.hidden = !isHidden;
            row.querySelector('.order-disclosure').setAttribute('aria-expanded', isHidden ? 'true' : 'false');

            if (icon) {
                icon.classList.toggle('fa-chevron-right', !isHidden);
                icon.classList.toggle('fa-chevron-down', isHidden);
            }
        }
    }

    /**
     * Quick assign a customer from dropdown in reconcile table
     * @param {number} customerId - The customer ID to assign
     * @param {string} repName - The rep to assign to
     */
    /** data-change target for the reconcile table's Assign dropdown (was an inline onchange). */
    quickAssignFromSelect(select) {
        const row = select.closest('tr');
        const id = row ? Number(row.dataset.customerId) : NaN;
        if (!isFinite(id)) return;
        this.quickAssign(id, select.value);
    }

    async quickAssign(customerId, repName) {
        if (!repName) return;

        const customer = (this.missingCustomersCache || []).find(c => c.ID_Customer === customerId);
        if (!customer) {
            this.showError('Customer not found. Please refresh and try again.');
            return;
        }

        try {
            let endpoint, payload;

            if (repName === 'Taneisha Clark' || repName === 'Nika Lao') {
                // Assign to Taneisha or Nika's CRM table
                const firstName = repName.split(' ')[0].toLowerCase();
                endpoint = `/api/crm-proxy/${firstName}-accounts`;
                payload = {
                    ID_Customer: customerId,
                    CompanyName: customer.companyName || `ID: ${customerId}`,
                    Account_Tier: `Win Back '26 ${repName.split(' ')[0].toUpperCase()}`
                };
            } else {
                // House, Ruthie Nhoung, Erik Mickelson, Jim Mickelson - all go to House accounts with Assigned_To
                endpoint = '/api/crm-proxy/house-accounts';
                payload = {
                    ID_Customer: customerId,
                    CompanyName: customer.companyName || `ID: ${customerId}`,
                    Assigned_To: repName
                };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            // Log assignment to history for audit trail
            await this.logAssignmentHistory(customer, repName);

            this.showToast(`${customer.companyName || `ID: ${customerId}`} assigned to ${repName}!`);

            // Remove from table locally instead of re-fetching from ManageOrders
            // This avoids rate limiting (3 API calls per refresh)
            this.removeCustomerFromReconcileTable(customerId);

        } catch (error) {
            console.error('Quick assign error:', error);
            this.showError(`Failed to assign customer: ${error.message}`);
        }
    }

    /**
     * Log assignment to history table for audit trail
     * @param {Object} customer - The customer data
     * @param {string} newRep - The rep being assigned to
     */
    async logAssignmentHistory(customer, newRep, changeSource = 'RECONCILE') {
        try {
            const previousRep = customer.shopWorksRep || 'Unassigned';
            const orderNumbers = (customer.orders || [])
                .map(o => o.orderNumber)
                .filter(n => n && n !== 'N/A')
                .join(', ');

            const resp = await fetch('/api/crm-proxy/assignment-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    customerId: customer.ID_Customer,
                    customerName: customer.companyName || `ID: ${customer.ID_Customer}`,
                    previousRep: previousRep,
                    newRep: newRep,
                    actionType: previousRep === 'Unassigned' ? 'ASSIGNED' : 'REASSIGNED',
                    changedBy: this.staffName || 'Erik',
                    changeSource: changeSource,
                    relatedOrders: orderNumbers
                })
            });
            // This row IS the ShopWorks To-Do entry — a failed log means the
            // assignment silently disappears from the checklist. Say so.
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        } catch (error) {
            console.warn('Failed to log assignment history:', error);
            this.showError(`Assignment saved, but it could NOT be added to the ShopWorks To-Do list (${error.message}). Write it down: ${customer.companyName || customer.ID_Customer} → ${newRep}.`);
        }
    }

    /**
     * Remove a customer row from the reconcile table after assignment
     * Avoids re-fetching data from ManageOrders (prevents rate limiting)
     * @param {number} customerId - The customer ID to remove
     */
    removeCustomerFromReconcileTable(customerId) {
        // Remove from cached data
        if (this.missingCustomersCache) {
            this.missingCustomersCache = this.missingCustomersCache.filter(
                c => c.ID_Customer !== customerId
            );
        }

        // Remove row from DOM
        const row = document.querySelector(`tr[data-customer-id="${customerId}"]`);
        if (row) {
            row.remove();
        }

        // Update summary stats
        this.updateReconcileSummary();

        // If no more customers, show empty state
        if (this.missingCustomersCache && this.missingCustomersCache.length === 0) {
            if (this.elements.reconcileEmpty) {
                this.elements.reconcileEmpty.hidden = false;
            }
            if (this.elements.reconcileSummary) {
                this.elements.reconcileSummary.hidden = true;
            }
            if (this.elements.reconcileTableBody) {
                this.elements.reconcileTableBody.parentElement.parentElement.hidden = true;
            }
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.hidden = true;
            }
        }
    }

    /**
     * Update the reconcile summary stats after removing a customer
     */
    updateReconcileSummary() {
        if (!this.elements.reconcileSummary || !this.missingCustomersCache) return;

        const customers = this.missingCustomersCache;
        const totalSales = customers.reduce((sum, c) => sum + (parseFloat(c.totalSales) || 0), 0);
        const totalOrders = customers.reduce((sum, c) => sum + (parseInt(c.orderCount) || 0), 0);

        this.elements.reconcileSummary.innerHTML = `
            <div class="reconcile-summary-stat">
                <div class="stat-value">${customers.length}</div>
                <div class="stat-label">Unassigned Customers</div>
            </div>
            <div class="reconcile-summary-stat">
                <div class="stat-value">${totalOrders}</div>
                <div class="stat-label">Total Orders</div>
            </div>
            <div class="reconcile-summary-stat">
                <div class="stat-value">${this.formatCurrency(totalSales)}</div>
                <div class="stat-label">Total Sales</div>
            </div>
        `;

        // Update "Add All" button count
        if (this.elements.reconcileAddAll && customers.length > 0) {
            this.elements.reconcileAddAll.innerHTML = `<i class="fas fa-plus" aria-hidden="true"></i> Add All ${customers.length} to House`;
        }
    }

    /**
     * Suggest which rep to assign based on customer data
     */
    suggestRep(customer) {
        const orderRep = (customer.rep || '').toLowerCase();
        const swRep = (customer.shopWorksRep || '').toLowerCase();

        // Check ShopWorks first
        if (swRep.includes('taneisha')) return 'Taneisha';
        if (swRep.includes('nika')) return 'Nika';

        // Fall back to order rep
        if (orderRep.includes('taneisha')) return 'Taneisha';
        if (orderRep.includes('nika')) return 'Nika';

        return 'House';
    }

    /**
     * Select a rep in the assignment modal
     */
    selectAssignRep(repName) {
        this.selectedAssignRep = repName;

        // Update button states
        document.querySelectorAll('.btn-assign-rep').forEach(btn => {
            const on = btn.dataset.rep === repName;
            btn.classList.toggle('selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });

        // Update tier dropdown options
        const tierSelect = document.getElementById('tier-select');
        if (tierSelect) {
            tierSelect.innerHTML = this.buildTierOptions(repName);
        }
    }

    /**
     * Build tier options for a rep
     */
    buildTierOptions(repName) {
        const repUpper = repName.toUpperCase();
        const tiers = repName === 'House' ? [
            'House-2026'
        ] : [
            `GOLD '26 - ${repUpper}`,
            `SILVER '26 - ${repUpper}`,
            `BRONZE '26 - ${repUpper}`,
            `Win Back '26 ${repUpper}`
        ];

        // Pre-select Win Back or current tier
        const currentTier = this.pendingReconcileAssignment?.shopWorksTier || '';
        const defaultTier = repName === 'House' ? 'House-2026' : `Win Back '26 ${repUpper}`;

        return tiers.map(tier => {
            const selected = (currentTier.includes(tier) || tier === defaultTier) ? 'selected' : '';
            return `<option value="${tier}" ${selected}>${tier}</option>`;
        }).join('');
    }

    /**
     * Close the assignment modal
     */
    closeAssignModal() {
        const container = document.getElementById('assign-modal-container');
        if (!container) return;
        container.remove();
        this.pendingReconcileAssignment = null;
        this.selectedAssignRep = null;
        const back = this._assignReturnFocus;
        this._assignReturnFocus = null;
        if (back && document.body.contains(back) && typeof back.focus === 'function') back.focus();
    }

    /**
     * Confirm assignment from reconcile modal
     */
    async confirmAssignFromReconcile() {
        const customer = this.pendingReconcileAssignment;
        const repName = this.selectedAssignRep;

        if (!customer || !repName) {
            this.showError('Please select a rep to assign to.');
            return;
        }

        const tierSelect = document.getElementById('tier-select');
        const accountTier = tierSelect ? tierSelect.value : `Win Back '26 ${repName.toUpperCase()}`;
        const syncToShopWorks = document.getElementById('sync-shopworks')?.checked ?? true;

        // Disable button during processing
        const confirmBtn = document.getElementById('confirm-assign-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="loading-spinner"></span> Assigning...';
        }

        try {
            // Create account object for assignment
            const account = {
                ID_Customer: customer.ID_Customer,
                CompanyName: customer.companyName || `ID: ${customer.ID_Customer}`
            };

            if (repName === 'House') {
                // Add to House accounts
                const response = await fetch(`${this.service.baseURL}/api/crm-proxy/house-accounts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        ID_Customer: account.ID_Customer,
                        CompanyName: account.CompanyName,
                        Assigned_To: 'House',
                        Notes: `Added from reconcile. Order Rep: ${customer.rep || 'Unknown'}. ShopWorks: ${customer.inShopWorks ? customer.shopWorksRep : 'Not found'}.`,
                        ShopWorks_Last_Sync: syncToShopWorks ? new Date().toISOString() : null
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to create House account');
                }
            } else {
                // Assign to Taneisha or Nika
                const endpoint = repName === 'Taneisha'
                    ? '/api/crm-proxy/taneisha-accounts'
                    : '/api/crm-proxy/nika-accounts';

                const response = await fetch(`${this.service.baseURL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        ID_Customer: account.ID_Customer,
                        CompanyName: account.CompanyName,
                        Account_Tier: accountTier,
                        ShopWorks_Last_Sync: syncToShopWorks ? new Date().toISOString() : null
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to create account in ${repName}'s table`);
                }
            }

            // Update ShopWorks if requested
            if (syncToShopWorks) {
                const fullRepName = this.getFullRepName(repName);
                const swSuccess = await this.service.updateShopWorksRep(
                    customer.ID_Customer,
                    fullRepName,
                    accountTier
                );

                if (!swSuccess) {
                    this.showToast('Warning: CRM updated but ShopWorks sync failed', 'warning');
                }
            }

            // Success!
            this.showToast(`${account.CompanyName} assigned to ${repName}!`);
            this.closeAssignModal();

            // Remove from table locally instead of re-fetching from ManageOrders
            // This avoids rate limiting (3 API calls per refresh)
            this.removeCustomerFromReconcileTable(customer.ID_Customer);

        } catch (error) {
            console.error('Assignment error:', error);
            this.showError(`Failed to assign customer: ${error.message}`);
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Assign';
            }
        }
    }

    /**
     * Get full rep name for ShopWorks
     */
    getFullRepName(repName) {
        const repMap = {
            'Taneisha Clark': 'Taneisha Clark',
            'Nika Lao': 'Nika Lao',
            'Ruthie Nhoung': 'Ruthie Nhoung',
            'Erik Mickelson': 'Erik Mickelson',
            'Jim Mickelson': 'Jim Mickelson',
            'House': 'House'
        };
        return repMap[repName] || repName;
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = HouseAccountsController.parseCalendarDate(dateStr);
            if (!date) return '';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    }

    /**
     * Caspio date fields arrive as "YYYY-MM-DD" or "YYYY-MM-DDT00:00:00(.000)(Z)". `new Date()` reads
     * those as UTC midnight = the previous evening in Pacific, so every date displayed a day early.
     * Calendar-day shapes are built as LOCAL dates; anything else goes through Date as before.
     */
    static parseCalendarDate(value) {
        const s = String(value == null ? '' : value).trim();
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/.exec(s);
        const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}


// ============================================================
// INITIALIZATION
// ============================================================

let houseController;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    houseController = new HouseAccountsController();
    window.houseController = houseController; // Expose for onclick handlers
    houseController.init();
});

// data-call target (was inline onclick — Rule 3).
window.dismissErrorBanner = function () { const b = document.getElementById('error-banner'); if (b) b.classList.remove('show'); };
