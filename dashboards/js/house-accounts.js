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
     */
    async fetchAccounts(filters = {}) {
        const params = new URLSearchParams();

        if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
        if (filters.search) params.append('search', filters.search);

        const url = `${this.baseURL}/api/crm-proxy/house-accounts${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return [];

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.accounts = data.Result || data.accounts || data || [];

        return this.accounts;
    }

    /**
     * Fetch stats for House accounts
     */
    async fetchStats() {
        const response = await fetch(`${this.baseURL}/api/crm-proxy/house-accounts/stats`, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        this.stats = await response.json();
        return this.stats;
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
                console.log(`[SW Lookup] ID ${customerId}: Auth error`);
                return null;
            }
            if (response.status === 404) {
                console.log(`[SW Lookup] ID ${customerId}: NOT FOUND (404)`);
                return { notFound: true };
            }
            if (response.status === 429) {
                console.log(`[SW Lookup] ID ${customerId}: RATE LIMITED (429)`);
                return { rateLimited: true };
            }
            if (!response.ok) {
                console.log(`[SW Lookup] ID ${customerId}: Error (${response.status})`);
                return null;
            }

            const data = await response.json();

            if (data.record) {
                console.log(`[SW Lookup] ID ${customerId}: Found - Rep="${data.record.CustomerServiceRep}"`);
                return data.record;
            } else {
                console.log(`[SW Lookup] ID ${customerId}: No record in response`);
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
            console.log(`[SW Batch] Fetching ${customerIds.length} customers in single request...`);

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

            console.log(`[SW Batch] Fetched ${data.count}/${customerIds.length} records`);
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

        try {
            await this.loadData();
        } catch (error) {
            this.showError('Unable to load House accounts. Please refresh the page or contact support.');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Error banner
            errorBanner: document.getElementById('error-banner'),
            errorMessage: document.getElementById('error-message'),

            // Stats
            statTotal: document.getElementById('stat-total'),
            statRuthie: document.getElementById('stat-ruthie'),
            statErik: document.getElementById('stat-erik'),
            statWeb: document.getElementById('stat-web'),
            statJim: document.getElementById('stat-jim'),
            statHouse: document.getElementById('stat-house'),

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
            gapReportModalOverlay: document.getElementById('gap-report-modal-overlay'),
            gapReportModalClose: document.getElementById('gap-report-modal-close'),
            gapReportRefreshBtn: document.getElementById('gap-report-refresh-btn'),
            gapReportLoading: document.getElementById('gap-report-loading'),
            gapReportContent: document.getElementById('gap-report-content'),
            gapReportClose: document.getElementById('gap-report-close')
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeReconcileModal();
                this.closeConfirmModal();
                this.closeGapReportModal();
            }
        });

        // Stat card click handlers for filtering
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => this.filterByStatCard(card));
        });
    }

    /**
     * Filter accounts by clicking a stat card
     * @param {HTMLElement} card - The clicked stat card
     */
    filterByStatCard(card) {
        const label = card.querySelector('.stat-label')?.textContent?.trim();

        // Remove active state from all cards
        document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));

        if (label === 'Total') {
            // Show all accounts
            this.clearFilters();
        } else {
            // Highlight clicked card
            card.classList.add('active');

            // Set assignee filter to match the label
            if (this.elements.assigneeSelect) {
                this.elements.assigneeSelect.value = label;
            }
            this.service.filters.assignedTo = label;
            this.applyFilters();
        }
    }

    /**
     * Load accounts and stats from API
     */
    async loadData() {
        this.showLoading(true);

        try {
            // Load accounts and stats in parallel
            await Promise.all([
                this.service.fetchAccounts(),
                this.service.fetchStats()
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

        // Sync stat card active state with dropdown
        document.querySelectorAll('.stat-card').forEach(card => {
            const label = card.querySelector('.stat-label')?.textContent?.trim();
            if (selectedAssignee && label === selectedAssignee) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

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

        // Remove active state from all stat cards
        document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));

        this.service.filters = {
            search: '',
            assignedTo: ''
        };

        this.filteredAccounts = [...this.service.accounts];
        this.renderAccounts();
        this.updateAccountsCount();
    }

    /**
     * Update stats display
     */
    updateStats() {
        const stats = this.service.stats || this.service.calculateLocalStats();

        if (this.elements.statTotal) {
            this.elements.statTotal.textContent = stats.total || 0;
        }

        // Update assignee stats
        const byAssignee = stats.byAssignee || {};

        if (this.elements.statRuthie) {
            this.elements.statRuthie.textContent = byAssignee['Ruthie'] || 0;
        }
        if (this.elements.statErik) {
            this.elements.statErik.textContent = byAssignee['Erik'] || 0;
        }
        if (this.elements.statWeb) {
            this.elements.statWeb.textContent = byAssignee['Web'] || 0;
        }
        if (this.elements.statJim) {
            this.elements.statJim.textContent = byAssignee['Jim'] || 0;
        }
        if (this.elements.statHouse) {
            this.elements.statHouse.textContent = byAssignee['House'] || 0;
        }
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
                this.elements.emptyState.style.display = 'block';
            }
            return;
        }

        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'none';
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
                                <i class="fas fa-user"></i>&nbsp;${this.escapeHtml(assignee)}
                            </span>
                        </div>

                        <div class="account-meta">
                            ${dateAdded ? `
                                <span><i class="fas fa-calendar-plus"></i> Added: ${dateAdded}</span>
                            ` : ''}
                            ${account.ID_Customer ? `
                                <span><i class="fas fa-hashtag"></i> ID: ${account.ID_Customer}</span>
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
                    <i class="fas fa-user"></i>&nbsp;Currently: ${this.escapeHtml(account.Assigned_To || 'Unassigned')}
                </span>
            `;
        }

        if (this.elements.confirmSubmit) {
            this.elements.confirmSubmit.className = `btn-save ${repName.toLowerCase()}`;
            this.elements.confirmSubmit.innerHTML = `<i class="fas fa-check"></i> Assign to ${repName}`;
        }

        // Show modal
        if (this.elements.confirmModal) {
            this.elements.confirmModal.classList.add('active');
        }
    }

    /**
     * Close confirmation modal
     */
    closeConfirmModal() {
        if (this.elements.confirmModal) {
            this.elements.confirmModal.classList.remove('active');
        }
        this.pendingAssignment = null;
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

            // Success
            this.closeConfirmModal();
            this.showToast(`${account.CompanyName} assigned to ${repName}!`);

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
    showError(message) {
        if (this.elements.errorBanner && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
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
    // RECONCILE MODAL METHODS
    // ============================================================

    /**
     * Open reconcile modal and fetch unassigned customers
     */
    async openReconcileModal() {
        if (this.elements.reconcileModalOverlay) {
            this.elements.reconcileModalOverlay.classList.add('active');
        }
        if (this.elements.reconcileLoading) {
            this.elements.reconcileLoading.style.display = 'flex';
            this.elements.reconcileLoading.innerHTML = '<span class="loading-spinner"></span> Loading unassigned customers...';
        }
        if (this.elements.reconcileResults) {
            this.elements.reconcileResults.style.display = 'none';
        }
        if (this.elements.reconcileFooter) {
            this.elements.reconcileFooter.style.display = 'none';
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
        if (this.elements.reconcileModalOverlay) {
            this.elements.reconcileModalOverlay.classList.remove('active');
        }
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
            console.log('[Reconcile] Refreshing data from Caspio...');
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
            this.elements.reconcileLoading.style.display = 'none';
        }
        if (this.elements.reconcileResults) {
            this.elements.reconcileResults.style.display = 'block';
        }

        const missingCustomers = result.missingCustomers || [];

        if (missingCustomers.length === 0) {
            if (this.elements.reconcileEmpty) {
                this.elements.reconcileEmpty.style.display = 'block';
            }
            if (this.elements.reconcileSummary) {
                this.elements.reconcileSummary.style.display = 'none';
            }
            if (this.elements.reconcileTableBody) {
                this.elements.reconcileTableBody.parentElement.parentElement.style.display = 'none';
            }
            if (this.elements.reconcileFooter) {
                this.elements.reconcileFooter.style.display = 'flex';
            }
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.style.display = 'none';
            }
            return;
        }

        if (this.elements.reconcileEmpty) {
            this.elements.reconcileEmpty.style.display = 'none';
        }
        if (this.elements.reconcileSummary) {
            this.elements.reconcileSummary.style.display = 'flex';
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
            this.elements.reconcileTableBody.parentElement.parentElement.style.display = 'block';
            this.elements.reconcileTableBody.innerHTML = missingCustomers.map(customer => {
                // Determine match status for indicators
                const orderRep = (customer.rep || '').toLowerCase().trim();
                const swRep = (customer.shopWorksRep || '').toLowerCase().trim();
                const repsMatch = orderRep && swRep && (orderRep.includes(swRep.split(' ')[0]) || swRep.includes(orderRep.split(' ')[0]));

                // Build ShopWorks Rep cell with status indicator
                let swRepCell = '';
                if (!customer.inShopWorks) {
                    swRepCell = '<span class="sw-status sw-not-found"><i class="fas fa-exclamation-triangle"></i> Not in SW</span>';
                } else if (repsMatch) {
                    swRepCell = `<span class="sw-status sw-match"><i class="fas fa-check"></i> ${this.escapeHtml(customer.shopWorksRep)}</span>`;
                } else {
                    swRepCell = `<span class="sw-status sw-mismatch"><i class="fas fa-exchange-alt"></i> ${this.escapeHtml(customer.shopWorksRep || 'House')}</span>`;
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
                <tr class="customer-row" data-customer-id="${customer.ID_Customer}" data-company-name="${this.escapeHtml(customer.companyName || '')}" onclick="window.houseController.toggleOrderDetails(this, event)">
                    <td class="expand-toggle"><i class="fas fa-chevron-right"></i></td>
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
                        <select class="assign-dropdown" onchange="window.houseController.quickAssign(${customer.ID_Customer}, this.value)" onclick="event.stopPropagation()">
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
                <tr class="order-details-row" style="display: none;">
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
            this.elements.reconcileFooter.style.display = 'flex';
        }
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.style.display = 'inline-flex';
            this.elements.reconcileAddAll.disabled = false;
            this.elements.reconcileAddAll.innerHTML = `<i class="fas fa-plus"></i> Add All ${missingCustomers.length} to House`;
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
                this.elements.reconcileAddAll.innerHTML = '<i class="fas fa-plus"></i> Add All to House';
            }
        }
    }

    // ============================================================
    // GAP REPORT MODAL METHODS
    // ============================================================

    /**
     * Open gap report modal and fetch full reconciliation data
     */
    async openGapReportModal() {
        if (this.elements.gapReportModalOverlay) {
            this.elements.gapReportModalOverlay.classList.add('active');
        }
        if (this.elements.gapReportLoading) {
            this.elements.gapReportLoading.style.display = 'flex';
        }
        if (this.elements.gapReportContent) {
            this.elements.gapReportContent.style.display = 'none';
        }

        try {
            const result = await this.service.fetchFullReconciliation();
            this.displayGapReport(result);
        } catch (error) {
            console.error('Gap report error:', error);
            this.showError('Failed to load gap report. Please try again.');
            this.closeGapReportModal();
        }
    }

    /**
     * Close gap report modal
     */
    closeGapReportModal() {
        if (this.elements.gapReportModalOverlay) {
            this.elements.gapReportModalOverlay.classList.remove('active');
        }
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
            this.elements.gapReportLoading.style.display = 'none';
        }
        if (this.elements.gapReportContent) {
            this.elements.gapReportContent.style.display = 'block';
        }

        const reps = result.reps || [];
        const totalConflicts = reps.reduce((sum, r) => sum + r.conflictCount, 0);
        const totalAmount = reps.reduce((sum, r) => sum + r.totalAmount, 0);

        if (totalConflicts === 0) {
            this.elements.gapReportContent.innerHTML = `
                <div class="gap-report-empty">
                    <i class="fas fa-check-circle"></i>
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
                    <div class="gap-rep-header" onclick="window.houseController.toggleGapRepSection(this)">
                        <div class="gap-rep-info">
                            <span class="gap-rep-avatar">${repInitials}</span>
                            <span class="gap-rep-name">${this.escapeHtml(rep.rep)}</span>
                        </div>
                        <div class="gap-rep-stats">
                            <span class="gap-conflict-count">${rep.conflictCount} conflicts</span>
                            <span class="gap-conflict-amount">${this.formatCurrency(rep.totalAmount)}</span>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                    <div class="gap-rep-conflicts" style="display: block;">
                        ${rep.outboundCount > 0 ? `
                            <div class="gap-conflict-group">
                                <div class="gap-group-header outbound">
                                    <i class="fas fa-arrow-right"></i>
                                    Outbound: ${rep.outboundCount} customers (${this.formatCurrency(rep.outboundAmount)})
                                    <span class="gap-group-hint">Orders BY ${rep.rep.split(' ')[0]} for customers NOT in their CRM</span>
                                </div>
                                ${this.renderGapConflicts(rep.conflicts.filter(c => c.conflictType === 'outbound'), rep.rep)}
                            </div>
                        ` : ''}
                        ${rep.inboundCount > 0 ? `
                            <div class="gap-conflict-group">
                                <div class="gap-group-header inbound">
                                    <i class="fas fa-arrow-left"></i>
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
                <i class="fas fa-info-circle"></i>
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
            <table class="gap-conflicts-table">
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
            <tr class="gap-conflict-row" onclick="window.houseController.toggleGapOrderDetails(this)">
                <td class="expand-toggle"><i class="fas fa-chevron-right"></i></td>
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
            <tr class="gap-orders-row" style="display: none;">
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
            const isHidden = conflictsDiv.style.display === 'none';
            conflictsDiv.style.display = isHidden ? 'block' : 'none';

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
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';

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
            <div class="modal-overlay active" id="assign-modal-overlay">
                <div class="modal-content" style="max-width: 480px;">
                    <div class="modal-header">
                        <h2>Assign Customer</h2>
                        <button class="close-btn" onclick="window.houseController.closeAssignModal()">
                            <i class="fas fa-times"></i>
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
                                <button class="btn-assign-rep taneisha" data-rep="Taneisha" onclick="window.houseController.selectAssignRep('Taneisha')">
                                    <i class="fas fa-user"></i> Taneisha
                                </button>
                                <button class="btn-assign-rep nika" data-rep="Nika" onclick="window.houseController.selectAssignRep('Nika')">
                                    <i class="fas fa-user"></i> Nika
                                </button>
                                <button class="btn-assign-rep house" data-rep="House" onclick="window.houseController.selectAssignRep('House')">
                                    <i class="fas fa-building"></i> House
                                </button>
                            </div>

                            <div class="tier-select-group">
                                <label for="tier-select">Account Tier</label>
                                <select id="tier-select" class="tier-select">
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
                        <button class="btn-cancel" onclick="window.houseController.closeAssignModal()">Cancel</button>
                        <button class="btn-save" id="confirm-assign-btn" onclick="window.houseController.confirmAssignFromReconcile()">
                            <i class="fas fa-check"></i> Assign
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        const container = document.createElement('div');
        container.id = 'assign-modal-container';
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

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
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';

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
    async logAssignmentHistory(customer, newRep) {
        try {
            const previousRep = customer.shopWorksRep || 'Unassigned';
            const orderNumbers = (customer.orders || [])
                .map(o => o.orderNumber)
                .filter(n => n && n !== 'N/A')
                .join(', ');

            await fetch('/api/crm-proxy/assignment-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    customerId: customer.ID_Customer,
                    customerName: customer.companyName || `ID: ${customer.ID_Customer}`,
                    previousRep: previousRep,
                    newRep: newRep,
                    actionType: previousRep === 'Unassigned' ? 'ASSIGNED' : 'REASSIGNED',
                    changedBy: 'Erik',
                    changeSource: 'RECONCILE',
                    relatedOrders: orderNumbers
                })
            });
        } catch (error) {
            // Log error but don't block the assignment
            console.warn('Failed to log assignment history:', error);
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
                this.elements.reconcileEmpty.style.display = 'block';
            }
            if (this.elements.reconcileSummary) {
                this.elements.reconcileSummary.style.display = 'none';
            }
            if (this.elements.reconcileTableBody) {
                this.elements.reconcileTableBody.parentElement.parentElement.style.display = 'none';
            }
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.style.display = 'none';
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
            this.elements.reconcileAddAll.innerHTML = `<i class="fas fa-plus"></i> Add All ${customers.length} to House`;
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
            btn.classList.remove('selected');
            if (btn.dataset.rep === repName) {
                btn.classList.add('selected');
            }
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
        if (container) {
            container.remove();
        }
        this.pendingReconcileAssignment = null;
        this.selectedAssignRep = null;
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
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Assign';
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
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
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
