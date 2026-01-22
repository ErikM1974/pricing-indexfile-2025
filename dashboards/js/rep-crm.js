/**
 * Rep CRM Dashboard (Config-Driven)
 * Shared service class and controller for account management
 *
 * Usage: Set window.REP_CONFIG before loading this script
 *
 * window.REP_CONFIG = {
 *     repName: 'Taneisha',
 *     apiEndpoint: '/api/taneisha-accounts',
 *     archiveEndpoint: '/api/taneisha/daily-sales-by-account'
 * };
 *
 * Features:
 * - Account list with filters
 * - Sales sync integration
 * - Reconcile accounts
 * - Sales breakdown by tier
 */

// ============================================================
// SERVICE CLASS
// ============================================================

class RepCRMService {
    constructor() {
        // Read config from window.REP_CONFIG or use defaults
        const config = window.REP_CONFIG || {
            repName: 'Taneisha',
            apiEndpoint: '/api/taneisha-accounts',
            archiveEndpoint: '/api/taneisha/daily-sales-by-account'
        };

        this.repName = config.repName;
        this.apiEndpoint = config.apiEndpoint;
        this.archiveEndpoint = config.archiveEndpoint;

        // Use APP_CONFIG if available, otherwise fallback
        this.baseURL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        this.accounts = [];
        this.selectedAccount = null;
        this.filters = {
            search: '',
            accountTier: '',
            priorityTier: '',
            month: '',
            trend: '',
            atRisk: false,
            overdue: false,
            products: []
        };
    }

    /**
     * Fetch all accounts with optional filters
     */
    async fetchAccounts(filters = {}) {
        const params = new URLSearchParams();

        if (filters.accountTier) params.append('accountTier', filters.accountTier);
        if (filters.priorityTier) params.append('priorityTier', filters.priorityTier);
        if (filters.month) params.append('month', filters.month);
        if (filters.trend) params.append('trend', filters.trend);
        if (filters.atRisk) params.append('atRisk', '1');
        if (filters.overdue) params.append('overdue', '1');
        if (filters.search) params.append('search', filters.search);

        const url = `${this.baseURL}${this.apiEndpoint}${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.accounts = data.Result || data.accounts || data || [];

        return this.accounts;
    }

    /**
     * Fetch a single account by ID
     */
    async fetchAccountById(id) {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}/${id}`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.selectedAccount = data.Result ? data.Result[0] : data;

        return this.selectedAccount;
    }

    /**
     * Sync sales from ManageOrders (uses HYBRID pattern: Archive + Fresh = True YTD)
     */
    async syncSales() {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}/sync-sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Reconcile accounts - Find customers with orders not in account list
     * @param {boolean} autoAdd - If true, automatically add missing customers
     * @returns {Promise<Object>} - { missingCount, missingCustomers, totalSales, ... }
     */
    async reconcileAccounts(autoAdd = false) {
        const url = autoAdd
            ? `${this.baseURL}${this.apiEndpoint}/reconcile?autoAdd=true`
            : `${this.baseURL}${this.apiEndpoint}/reconcile`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // ============================================================
    // ARCHIVE FUNCTIONS (YTD tracking beyond ManageOrders 60-day limit)
    // ============================================================

    /**
     * Fetch YTD per-customer totals from Caspio archive
     */
    async fetchYTDPerCustomerFromArchive(year = new Date().getFullYear()) {
        const response = await fetch(`${this.baseURL}${this.archiveEndpoint}/ytd?year=${year}`);

        if (!response.ok) {
            if (response.status === 404) {
                return { year, customers: [], lastArchivedDate: null, totalRevenue: 0, totalOrders: 0 };
            }
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Fetch archived daily sales for a date range
     */
    async fetchArchivedSalesByCustomer(startDate, endDate) {
        const response = await fetch(
            `${this.baseURL}${this.archiveEndpoint}?start=${startDate}&end=${endDate}`
        );

        if (!response.ok) {
            if (response.status === 404) {
                return { days: [], summary: { customers: [], totalRevenue: 0, totalOrders: 0 } };
            }
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get archive status info
     */
    async getArchiveStatus() {
        try {
            const ytdData = await this.fetchYTDPerCustomerFromArchive();
            return {
                year: ytdData.year,
                customerCount: ytdData.customers?.length || 0,
                lastArchivedDate: ytdData.lastArchivedDate,
                totalArchivedRevenue: ytdData.totalRevenue,
                totalArchivedOrders: ytdData.totalOrders
            };
        } catch (error) {
            return {
                year: new Date().getFullYear(),
                customerCount: 0,
                lastArchivedDate: null,
                totalArchivedRevenue: 0,
                totalArchivedOrders: 0,
                error: error.message
            };
        }
    }

    /**
     * Calculate stats from loaded accounts
     */
    calculateStats() {
        const stats = {
            total: 0,
            goldTier: 0,
            silverTier: 0,
            bronzeTier: 0,
            winBack: 0,
            unclassified: 0,
            atRisk: 0,
            overdue: 0,
            ytdRevenue: 0,
            goldRevenue: 0,
            silverRevenue: 0,
            bronzeRevenue: 0,
            winBackRevenue: 0,
            unclassifiedRevenue: 0,
            winBackBonus: 0,
            bountyEarned: 0,
            bountyPotential: 0
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.accounts.forEach(account => {
            stats.total++;

            const tier = (account.Account_Tier || '').toUpperCase();
            const ytdSales = parseFloat(account.YTD_Sales_2026) || 0;

            stats.ytdRevenue += ytdSales;

            if (tier.includes('GOLD')) {
                stats.goldTier++;
                stats.goldRevenue += ytdSales;
            } else if (tier.includes('SILVER')) {
                stats.silverTier++;
                stats.silverRevenue += ytdSales;
            } else if (tier.includes('BRONZE')) {
                stats.bronzeTier++;
                stats.bronzeRevenue += ytdSales;
            } else if (tier.includes('WIN BACK')) {
                stats.winBack++;
                stats.winBackRevenue += ytdSales;

                if (account.Won_Back_Date) {
                    stats.winBackBonus += ytdSales * 0.05;
                }

                const avgProfit = parseFloat(account.Avg_Annual_Profit) || 0;
                stats.bountyPotential += avgProfit * 0.05;

                if (account.Won_Back_Date) {
                    stats.bountyEarned += ytdSales * 0.05;
                }
            } else {
                stats.unclassified++;
                stats.unclassifiedRevenue += ytdSales;
            }

            if (account.At_Risk === true || account.At_Risk === 'true' || account.At_Risk === 1) {
                stats.atRisk++;
            }

            if (account.Next_Follow_Up) {
                const followUpDate = new Date(account.Next_Follow_Up);
                followUpDate.setHours(0, 0, 0, 0);
                if (followUpDate < today) {
                    stats.overdue++;
                }
            }
        });

        return stats;
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

            if (filters.accountTier) {
                const tier = (account.Account_Tier || '').toUpperCase();
                // Extract tier keyword from filter (e.g., "GOLD '26-TANEISHA" → "GOLD", "Win Back '26 TANEISHA" → "WIN BACK")
                const filterTier = filters.accountTier.toUpperCase();
                let tierKeyword = '';
                if (filterTier.includes('GOLD')) tierKeyword = 'GOLD';
                else if (filterTier.includes('SILVER')) tierKeyword = 'SILVER';
                else if (filterTier.includes('BRONZE')) tierKeyword = 'BRONZE';
                else if (filterTier.includes('WIN BACK')) tierKeyword = 'WIN BACK';
                else tierKeyword = filterTier; // Fallback to full value

                if (!tier.includes(tierKeyword)) {
                    return false;
                }
            }

            if (filters.priorityTier) {
                if (account.Priority_Tier !== filters.priorityTier) {
                    return false;
                }
            }

            if (filters.month) {
                const primaryMonth = (account.Primary_Month || '').toLowerCase();
                if (!primaryMonth.startsWith(filters.month.toLowerCase())) {
                    return false;
                }
            }

            if (filters.trend) {
                const trend = (account.Trend || '').toLowerCase();
                if (!trend.includes(filters.trend.toLowerCase())) {
                    return false;
                }
            }

            if (filters.atRisk) {
                if (account.At_Risk !== true && account.At_Risk !== 'true' && account.At_Risk !== 1) {
                    return false;
                }
            }

            if (filters.products && filters.products.length > 0) {
                const hasProduct = filters.products.some(product => {
                    const field = `Buys_${product}`;
                    return account[field] === true || account[field] === 'true' || account[field] === 1;
                });
                if (!hasProduct) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Get tier display info
     */
    getTierInfo(tierValue) {
        const tier = (tierValue || '').toUpperCase();

        if (tier.includes('GOLD')) {
            return { class: 'gold', label: 'Gold' };
        } else if (tier.includes('SILVER')) {
            return { class: 'silver', label: 'Silver' };
        } else if (tier.includes('BRONZE')) {
            return { class: 'bronze', label: 'Bronze' };
        } else if (tier.includes('WIN BACK')) {
            return { class: 'win-back', label: 'Win Back' };
        }

        return { class: '', label: '' };
    }

    /**
     * Get health score class
     */
    getHealthClass(score) {
        const numScore = parseFloat(score) || 0;
        if (numScore >= 70) return 'good';
        if (numScore >= 40) return 'warning';
        return 'danger';
    }
}


// ============================================================
// CONTROLLER CLASS
// ============================================================

class RepCRMController {
    constructor() {
        this.service = new RepCRMService();

        // DOM elements
        this.elements = {};

        // State
        this.filteredAccounts = [];
        this.searchDebounceTimer = null;

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
            await this.loadAccounts();
            this.updateStats();
            this.renderAccounts();
        } catch (error) {
            this.showError('Unable to load accounts. Please refresh the page or contact support.');
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
            statGold: document.getElementById('stat-gold'),
            statWinBack: document.getElementById('stat-win-back'),
            statAtRisk: document.getElementById('stat-at-risk'),
            statOverdue: document.getElementById('stat-overdue'),

            // Sales Breakdown by Tier
            ytdTotal: document.getElementById('ytd-total'),
            goldRevenue: document.getElementById('gold-revenue'),
            goldCount: document.getElementById('gold-count'),
            silverRevenue: document.getElementById('silver-revenue'),
            silverCount: document.getElementById('silver-count'),
            bronzeRevenue: document.getElementById('bronze-revenue'),
            bronzeCount: document.getElementById('bronze-count'),
            winbackRevenue: document.getElementById('winback-revenue'),
            winbackCount: document.getElementById('winback-count'),
            winbackBonus: document.getElementById('winback-bonus'),
            unclassifiedRevenue: document.getElementById('unclassified-revenue'),
            unclassifiedCount: document.getElementById('unclassified-count'),

            // Filters
            searchInput: document.getElementById('filter-search'),
            tierSelect: document.getElementById('filter-tier'),
            prioritySelect: document.getElementById('filter-priority'),
            monthSelect: document.getElementById('filter-month'),
            trendSelect: document.getElementById('filter-trend'),
            productToggles: document.querySelectorAll('.product-toggle'),
            clearFiltersBtn: document.getElementById('clear-filters-btn'),

            // Quick actions
            quickAtRisk: document.getElementById('quick-at-risk'),
            quickOverdue: document.getElementById('quick-overdue'),
            quickCallMonth: document.getElementById('quick-call-month'),

            // Accounts
            accountsGrid: document.getElementById('accounts-grid'),
            accountsCount: document.getElementById('accounts-count'),
            loadingOverlay: document.getElementById('loading-overlay'),
            emptyState: document.getElementById('empty-state'),

            // Sync
            syncBtn: document.getElementById('sync-btn'),
            syncStatus: document.getElementById('sync-status'),
            lastSynced: document.getElementById('last-synced'),

            // Reconcile
            reconcileBtn: document.getElementById('reconcile-btn'),
            reconcileModalOverlay: document.getElementById('reconcile-modal-overlay'),
            reconcileModalClose: document.getElementById('reconcile-modal-close'),
            reconcileLoading: document.getElementById('reconcile-loading'),
            reconcileResults: document.getElementById('reconcile-results'),
            reconcileSummary: document.getElementById('reconcile-summary'),
            reconcileTableBody: document.getElementById('reconcile-table-body'),
            reconcileEmpty: document.getElementById('reconcile-empty'),
            reconcileFooter: document.getElementById('reconcile-footer'),
            reconcileCancel: document.getElementById('reconcile-cancel'),
            reconcileAddAll: document.getElementById('reconcile-add-all')
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

        // Filter dropdowns
        const filterSelects = [
            this.elements.tierSelect,
            this.elements.prioritySelect,
            this.elements.monthSelect,
            this.elements.trendSelect
        ];

        filterSelects.forEach(select => {
            if (select) {
                select.addEventListener('change', this.handleFilterChange);
            }
        });

        // Product toggles
        this.elements.productToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                toggle.classList.toggle('active');
                this.handleFilterChange();
            });
        });

        // Clear filters
        if (this.elements.clearFiltersBtn) {
            this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Quick action buttons
        if (this.elements.quickAtRisk) {
            this.elements.quickAtRisk.addEventListener('click', () => this.toggleQuickFilter('atRisk'));
        }
        if (this.elements.quickOverdue) {
            this.elements.quickOverdue.addEventListener('click', () => this.toggleQuickFilter('overdue'));
        }
        if (this.elements.quickCallMonth) {
            this.elements.quickCallMonth.addEventListener('click', () => this.toggleQuickFilter('callMonth'));
        }

        // Sync button
        if (this.elements.syncBtn) {
            this.elements.syncBtn.addEventListener('click', () => this.syncSales());
        }

        // Reconcile button and modal
        if (this.elements.reconcileBtn) {
            this.elements.reconcileBtn.addEventListener('click', () => this.openReconcileModal());
        }
        if (this.elements.reconcileModalClose) {
            this.elements.reconcileModalClose.addEventListener('click', () => this.closeReconcileModal());
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeReconcileModal();
            }
        });
    }

    /**
     * Load accounts from API
     */
    async loadAccounts() {
        this.showLoading(true);

        try {
            await this.service.fetchAccounts();
            this.filteredAccounts = [...this.service.accounts];
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
        this.service.filters.accountTier = this.elements.tierSelect?.value || '';
        this.service.filters.priorityTier = this.elements.prioritySelect?.value || '';
        this.service.filters.month = this.elements.monthSelect?.value || '';
        this.service.filters.trend = this.elements.trendSelect?.value || '';

        // Get active product toggles
        this.service.filters.products = [];
        this.elements.productToggles.forEach(toggle => {
            if (toggle.classList.contains('active')) {
                this.service.filters.products.push(toggle.dataset.product);
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
        if (this.elements.tierSelect) this.elements.tierSelect.value = '';
        if (this.elements.prioritySelect) this.elements.prioritySelect.value = '';
        if (this.elements.monthSelect) this.elements.monthSelect.value = '';
        if (this.elements.trendSelect) this.elements.trendSelect.value = '';

        this.elements.productToggles.forEach(toggle => {
            toggle.classList.remove('active');
        });

        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        this.service.filters = {
            search: '',
            accountTier: '',
            priorityTier: '',
            month: '',
            trend: '',
            atRisk: false,
            overdue: false,
            products: []
        };

        this.filteredAccounts = [...this.service.accounts];
        this.renderAccounts();
        this.updateAccountsCount();
    }

    /**
     * Toggle quick filter buttons
     */
    toggleQuickFilter(filterType) {
        const buttons = {
            atRisk: this.elements.quickAtRisk,
            overdue: this.elements.quickOverdue,
            callMonth: this.elements.quickCallMonth
        };

        const button = buttons[filterType];
        if (!button) return;

        const isActive = button.classList.toggle('active');

        if (filterType === 'atRisk') {
            this.service.filters.atRisk = isActive;
        } else if (filterType === 'overdue') {
            this.service.filters.overdue = isActive;
        } else if (filterType === 'callMonth') {
            if (isActive) {
                const currentMonth = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase();
                this.service.filters.month = currentMonth;
            } else {
                this.service.filters.month = '';
            }
        }

        this.applyFilters();
    }

    /**
     * Update stats display
     */
    updateStats() {
        const stats = this.service.calculateStats();

        if (this.elements.statTotal) {
            this.elements.statTotal.textContent = stats.total;
        }
        if (this.elements.statGold) {
            this.elements.statGold.textContent = stats.goldTier;
        }
        if (this.elements.statWinBack) {
            this.elements.statWinBack.textContent = stats.winBack;
        }
        if (this.elements.statAtRisk) {
            this.elements.statAtRisk.textContent = stats.atRisk;
        }
        if (this.elements.statOverdue) {
            this.elements.statOverdue.textContent = stats.overdue;
        }

        // Sales Breakdown by Tier
        if (this.elements.ytdTotal) {
            this.elements.ytdTotal.textContent = this.formatCurrency(stats.ytdRevenue);
        }
        if (this.elements.goldRevenue) {
            this.elements.goldRevenue.textContent = this.formatCurrency(stats.goldRevenue);
            this.elements.goldCount.textContent = `${stats.goldTier} account${stats.goldTier !== 1 ? 's' : ''}`;
        }
        if (this.elements.silverRevenue) {
            this.elements.silverRevenue.textContent = this.formatCurrency(stats.silverRevenue);
            this.elements.silverCount.textContent = `${stats.silverTier} account${stats.silverTier !== 1 ? 's' : ''}`;
        }
        if (this.elements.bronzeRevenue) {
            this.elements.bronzeRevenue.textContent = this.formatCurrency(stats.bronzeRevenue);
            this.elements.bronzeCount.textContent = `${stats.bronzeTier} account${stats.bronzeTier !== 1 ? 's' : ''}`;
        }
        if (this.elements.winbackRevenue) {
            this.elements.winbackRevenue.textContent = this.formatCurrency(stats.winBackRevenue);
            this.elements.winbackCount.textContent = `${stats.winBack} account${stats.winBack !== 1 ? 's' : ''}`;
        }
        if (this.elements.winbackBonus) {
            this.elements.winbackBonus.textContent = this.formatCurrency(stats.winBackBonus);
        }
        if (this.elements.unclassifiedRevenue) {
            this.elements.unclassifiedRevenue.textContent = this.formatCurrency(stats.unclassifiedRevenue);
            this.elements.unclassifiedCount.textContent = `${stats.unclassified} account${stats.unclassified !== 1 ? 's' : ''}`;
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
            const tierInfo = this.service.getTierInfo(account.Account_Tier);
            const healthClass = this.service.getHealthClass(account.Health_Score);
            const isAtRisk = account.At_Risk === true || account.At_Risk === 'true' || account.At_Risk === 1;
            const isOverdue = this.isOverdue(account);
            const priority = (account.Priority_Tier || 'D').toLowerCase();

            return `
                <div class="account-card" data-id="${account.PK_ID}">
                    <div class="priority-bar priority-${priority}"></div>
                    <div class="account-card-content">
                        <div class="card-header">
                            <div>
                                <h3 class="company-name">${this.escapeHtml(account.CompanyName)}</h3>
                                <div class="card-badges">
                                    ${tierInfo.label ? `<span class="tier-badge ${tierInfo.class}">${tierInfo.label}</span>` : ''}
                                    ${isAtRisk ? '<span class="status-badge at-risk"><i class="fas fa-exclamation-triangle"></i> At Risk</span>' : ''}
                                    ${isOverdue ? '<span class="status-badge overdue"><i class="fas fa-clock"></i> Overdue</span>' : ''}
                                    ${account.Contact_Status ? `<span class="status-badge contact-status">${this.escapeHtml(account.Contact_Status)}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="contact-info">
                            ${account.Main_Contact_Name ? `
                                <div class="contact-name">
                                    <i class="fas fa-user"></i>
                                    ${this.escapeHtml(account.Main_Contact_Name)}
                                </div>
                            ` : ''}
                            <div class="contact-links">
                                ${account.Main_Contact_Email ? `
                                    <a href="mailto:${this.escapeHtml(account.Main_Contact_Email)}">
                                        <i class="fas fa-envelope"></i> Email
                                    </a>
                                ` : ''}
                                ${account.Main_Contact_Phone ? `
                                    <a href="tel:${this.escapeHtml(account.Main_Contact_Phone)}">
                                        <i class="fas fa-phone"></i> ${this.escapeHtml(account.Main_Contact_Phone)}
                                    </a>
                                ` : ''}
                            </div>
                        </div>

                        <div class="account-details">
                            ${account.Primary_Month ? `
                                <div class="detail-item">
                                    <i class="fas fa-calendar"></i>
                                    Best: <strong>${this.escapeHtml(account.Primary_Month)}</strong>
                                </div>
                            ` : ''}
                            ${account.Top_Product_1 ? `
                                <div class="detail-item">
                                    <i class="fas fa-tshirt"></i>
                                    Top: <strong>${this.escapeHtml(account.Top_Product_1)}</strong>
                                </div>
                            ` : ''}
                            ${account.Avg_Annual_Profit ? `
                                <div class="detail-item">
                                    <i class="fas fa-dollar-sign"></i>
                                    Avg: <strong>${this.formatCurrency(account.Avg_Annual_Profit)}</strong>
                                </div>
                            ` : ''}
                            ${account.Health_Score ? `
                                <div class="detail-item">
                                    <span class="health-score ${healthClass}">${Math.round(account.Health_Score)}</span>
                                </div>
                            ` : ''}
                            ${account.Days_Since_Last_Order ? `
                                <div class="detail-item">
                                    <i class="fas fa-history"></i>
                                    ${this.formatDuration(account.Days_Since_Last_Order)}
                                </div>
                            ` : ''}
                        </div>

                        ${account.YTD_Sales_2026 ? `
                            <div class="ytd-sales-row">
                                <div class="ytd-sales">
                                    <i class="fas fa-chart-line"></i>
                                    2026 YTD: ${this.formatCurrency(account.YTD_Sales_2026)}
                                </div>
                                ${account.Order_Count_2026 ? `
                                    <div class="order-count">(${account.Order_Count_2026} orders)</div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Check if account is overdue
     */
    isOverdue(account) {
        if (!account.Next_Follow_Up) return false;

        const followUpDate = new Date(account.Next_Follow_Up);
        followUpDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return followUpDate < today;
    }

    /**
     * Sync sales from ManageOrders
     */
    async syncSales() {
        if (this.elements.syncBtn) {
            this.elements.syncBtn.disabled = true;
            this.elements.syncBtn.innerHTML = '<span class="loading-spinner"></span> Syncing...';
        }

        if (this.elements.syncStatus) {
            this.elements.syncStatus.className = 'sync-status syncing';
            this.elements.syncStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Syncing sales data...';
        }

        try {
            const result = await this.service.syncSales();

            if (this.elements.syncStatus) {
                this.elements.syncStatus.className = 'sync-status success';
                this.elements.syncStatus.innerHTML = '<i class="fas fa-check"></i> Sync complete';
            }

            if (this.elements.lastSynced) {
                this.elements.lastSynced.textContent = 'Last synced: just now';
            }

            // Reload accounts
            await this.loadAccounts();
            this.updateStats();
            this.applyFilters();

        } catch (error) {
            if (this.elements.syncStatus) {
                this.elements.syncStatus.className = 'sync-status error';
                this.elements.syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sync failed';
            }
            this.showError('Sales sync failed. Please try again later.');
        } finally {
            if (this.elements.syncBtn) {
                this.elements.syncBtn.disabled = false;
                this.elements.syncBtn.innerHTML = '<i class="fas fa-sync"></i> Sync Sales';
            }
        }
    }

    /**
     * Open reconcile modal and fetch missing customers
     */
    async openReconcileModal() {
        if (this.elements.reconcileModalOverlay) {
            this.elements.reconcileModalOverlay.classList.add('active');
        }
        if (this.elements.reconcileLoading) {
            this.elements.reconcileLoading.style.display = 'flex';
        }
        if (this.elements.reconcileResults) {
            this.elements.reconcileResults.style.display = 'none';
        }
        if (this.elements.reconcileFooter) {
            this.elements.reconcileFooter.style.display = 'none';
        }

        try {
            const result = await this.service.reconcileAccounts(false);
            this.displayReconcileResults(result);
        } catch (error) {
            this.showError('Failed to check for missing customers. Please try again.');
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
                    <div class="stat-label">Missing Customers</div>
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
            this.elements.reconcileTableBody.innerHTML = missingCustomers.map(customer => `
                <tr>
                    <td class="company-name">${this.escapeHtml(customer.companyName || customer.CustomerName || 'Unknown')}</td>
                    <td class="order-count">${customer.orderCount || 0}</td>
                    <td class="sales-amount">${this.formatCurrency(customer.totalSales || 0)}</td>
                    <td class="last-order">${this.formatDate(customer.lastOrderDate)}</td>
                </tr>
            `).join('');
        }

        if (this.elements.reconcileFooter) {
            this.elements.reconcileFooter.style.display = 'flex';
        }
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.style.display = 'inline-flex';
            this.elements.reconcileAddAll.disabled = false;
            this.elements.reconcileAddAll.innerHTML = `<i class="fas fa-plus"></i> Add All ${missingCustomers.length} Missing`;
        }
    }

    /**
     * Add all missing customers to the account list
     */
    async addAllMissingCustomers() {
        if (this.elements.reconcileAddAll) {
            this.elements.reconcileAddAll.disabled = true;
            this.elements.reconcileAddAll.innerHTML = '<span class="loading-spinner"></span> Adding...';
        }

        try {
            const result = await this.service.reconcileAccounts(true);

            const addedCount = result.addedCount || result.missingCustomers?.length || 0;
            this.showCelebration(`Added ${addedCount} customers to your account list!`, 'winback');

            this.closeReconcileModal();
            await this.loadAccounts();
            this.updateStats();
            this.applyFilters();

        } catch (error) {
            this.showError('Failed to add missing customers. Please try again.');
        } finally {
            if (this.elements.reconcileAddAll) {
                this.elements.reconcileAddAll.disabled = false;
                this.elements.reconcileAddAll.innerHTML = '<i class="fas fa-plus"></i> Add All Missing';
            }
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    /**
     * Show celebration toast
     */
    showCelebration(message, type = 'winback') {
        const toast = document.createElement('div');
        toast.className = `celebration-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
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
     * Hide error banner
     */
    hideError() {
        if (this.elements.errorBanner) {
            this.elements.errorBanner.classList.remove('show');
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
     * Format days as human-readable duration
     */
    formatDuration(totalDays) {
        const days = parseInt(totalDays) || 0;
        if (days < 30) return `${days} days`;

        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        const remainingDays = days % 30;

        const parts = [];
        if (years > 0) parts.push(`${years}y`);
        if (months > 0) parts.push(`${months}m`);
        if (remainingDays > 0) parts.push(`${remainingDays}d`);

        return parts.join(' ') || '0 days';
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.crmController = new RepCRMController();
    window.crmController.init();
});
