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
 * - Sales breakdown by tier
 */

// ============================================================
// SERVICE CLASS
// ============================================================

class RepCRMService {
    constructor() {
        // Read config from window.REP_CONFIG or use defaults
        // Note: apiEndpoint uses /api/crm-proxy/* for session-protected access
        const config = window.REP_CONFIG || {
            repName: 'Taneisha',
            apiEndpoint: '/api/crm-proxy/taneisha-accounts',
            archiveEndpoint: '/api/taneisha/daily-sales-by-account'
        };

        this.repName = config.repName;
        this.apiEndpoint = config.apiEndpoint;
        this.archiveEndpoint = config.archiveEndpoint;

        // Use same-origin proxy for security (session validated on each request)
        // The proxy at /api/crm-proxy/* forwards to caspio-pricing-proxy with auth
        this.baseURL = '';

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
     * Fetch a single account by ID
     */
    async fetchAccountById(id) {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}/${id}`, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return null;

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
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });

        if (this.handleAuthError(response)) return null;

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Sync ownership from Sales_Reps_2026 (ShopWorks source of truth)
     * This ensures the CRM table has the correct customer assignments
     */
    async syncOwnership() {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}/sync-ownership`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });

        if (this.handleAuthError(response)) return null;

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
        const response = await fetch(`${this.baseURL}${this.archiveEndpoint}/ytd?year=${year}`, { credentials: 'same-origin' });

        if (this.handleAuthError(response)) return { year, customers: [], lastArchivedDate: null, totalRevenue: 0, totalOrders: 0 };

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
            `${this.baseURL}${this.archiveEndpoint}?start=${startDate}&end=${endDate}`,
            { credentials: 'same-origin' }
        );

        if (this.handleAuthError(response)) return { days: [], summary: { customers: [], totalRevenue: 0, totalOrders: 0 } };

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

                // Handle unclassified filter - accounts with no tier or empty tier
                if (filterTier === 'UNCLASSIFIED') {
                    const hasKnownTier = tier.includes('GOLD') || tier.includes('SILVER') ||
                                         tier.includes('BRONZE') || tier.includes('WIN BACK');
                    if (hasKnownTier) {
                        return false;
                    }
                } else {
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
        this.displayWelcomeMessage();

        try {
            await this.loadAccounts();
            this.updateStats();
            this.renderAccounts();
        } catch (error) {
            this.showError('Unable to load accounts. Please refresh the page or contact support.');
        }
    }

    /**
     * Display welcome message from session storage
     */
    displayWelcomeMessage() {
        const userName = sessionStorage.getItem('nwca_user_name');
        if (userName) {
            const firstName = userName.split(' ')[0];
            const userNameEl = document.getElementById('userName');
            const userWelcomeEl = document.getElementById('userWelcome');
            if (userNameEl && userWelcomeEl) {
                userNameEl.textContent = firstName;
                userWelcomeEl.style.display = 'flex';
            }
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

            // Header Stats
            headerTotal: document.getElementById('header-total'),
            headerAtRisk: document.getElementById('header-at-risk'),

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

            // Accounts
            accountsGrid: document.getElementById('accounts-grid'),
            accountsCount: document.getElementById('accounts-count'),
            loadingOverlay: document.getElementById('loading-overlay'),
            emptyState: document.getElementById('empty-state'),

            // Sync
            syncBtn: document.getElementById('sync-btn'),
            syncOwnershipBtn: document.getElementById('sync-ownership-btn'),
            syncStatus: document.getElementById('sync-status'),
            lastSynced: document.getElementById('last-synced'),

            // Account Detail Modal
            accountDetailModalOverlay: document.getElementById('account-detail-modal-overlay'),
            accountDetailModalClose: document.getElementById('account-detail-modal-close'),
            accountDetailClose: document.getElementById('account-detail-close'),
            accountDetailCompany: document.getElementById('account-detail-company'),
            accountDetailBadges: document.getElementById('account-detail-badges'),
            accountDetailBody: document.getElementById('account-detail-body')
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

        // Header stat clicks
        if (this.elements.headerTotal) {
            this.elements.headerTotal.addEventListener('click', () => this.clearFilters());
        }
        if (this.elements.headerAtRisk) {
            this.elements.headerAtRisk.addEventListener('click', () => this.toggleAtRiskFilter());
        }

        // Tier card clicks
        document.querySelectorAll('.tier-card').forEach(card => {
            card.addEventListener('click', () => {
                const tierClass = [...card.classList].find(c =>
                    ['gold', 'silver', 'bronze', 'win-back', 'unclassified'].includes(c)
                );
                if (tierClass) {
                    this.toggleTierFilter(tierClass);
                }
            });
        });

        // Sync button
        if (this.elements.syncBtn) {
            this.elements.syncBtn.addEventListener('click', () => this.syncSales());
        }

        // Sync ownership button (sync from ShopWorks)
        if (this.elements.syncOwnershipBtn) {
            this.elements.syncOwnershipBtn.addEventListener('click', () => this.syncOwnership());
        }

        // Account Detail Modal
        if (this.elements.accountDetailModalClose) {
            this.elements.accountDetailModalClose.addEventListener('click', () => this.closeAccountDetailModal());
        }
        if (this.elements.accountDetailClose) {
            this.elements.accountDetailClose.addEventListener('click', () => this.closeAccountDetailModal());
        }
        if (this.elements.accountDetailModalOverlay) {
            this.elements.accountDetailModalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.accountDetailModalOverlay) {
                    this.closeAccountDetailModal();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAccountDetailModal();
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

        // Clear tier card active states
        document.querySelectorAll('.tier-card').forEach(card => {
            card.classList.remove('active');
        });

        // Clear header at-risk active state
        if (this.elements.headerAtRisk) {
            this.elements.headerAtRisk.classList.remove('active');
        }

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
     * Toggle tier filter via tier card click
     */
    toggleTierFilter(tier) {
        // Map CSS class to filter value
        const tierMap = {
            'gold': 'GOLD',
            'silver': 'SILVER',
            'bronze': 'BRONZE',
            'win-back': 'WIN BACK',
            'unclassified': 'UNCLASSIFIED'
        };

        const filterValue = tierMap[tier];
        const currentFilter = this.service.filters.accountTier.toUpperCase();

        // Toggle: if same tier, clear; otherwise set new tier
        if (currentFilter === filterValue || currentFilter.includes(filterValue)) {
            this.service.filters.accountTier = '';
        } else {
            this.service.filters.accountTier = filterValue;
        }

        // Also update the tier dropdown to stay in sync (only for known tiers)
        if (this.elements.tierSelect && tier !== 'unclassified') {
            const options = this.elements.tierSelect.options;
            let foundIndex = 0;
            for (let i = 0; i < options.length; i++) {
                if (options[i].value.toUpperCase().includes(filterValue)) {
                    foundIndex = i;
                    break;
                }
            }
            this.elements.tierSelect.selectedIndex = this.service.filters.accountTier ? foundIndex : 0;
        } else if (this.elements.tierSelect && tier === 'unclassified') {
            // Clear dropdown for unclassified since it's not in dropdown
            this.elements.tierSelect.selectedIndex = 0;
        }

        // Update UI active states
        document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('active'));
        if (this.service.filters.accountTier) {
            document.querySelector(`.tier-card.${tier}`)?.classList.add('active');
        }

        this.applyFilters();
    }

    /**
     * Toggle at-risk filter via header stat click
     */
    toggleAtRiskFilter() {
        this.service.filters.atRisk = !this.service.filters.atRisk;
        this.elements.headerAtRisk?.classList.toggle('active', this.service.filters.atRisk);
        this.applyFilters();
    }

    /**
     * Update stats display
     */
    updateStats() {
        const stats = this.service.calculateStats();

        // Update header stats
        if (this.elements.headerTotal) {
            this.elements.headerTotal.querySelector('.header-stat-value').textContent = stats.total;
        }
        if (this.elements.headerAtRisk) {
            this.elements.headerAtRisk.querySelector('.header-stat-value').textContent = stats.atRisk;
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

        // Add click handlers to account cards
        this.elements.accountsGrid.querySelectorAll('.account-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking on email/phone links
                if (e.target.closest('a')) return;

                const accountId = card.dataset.id;
                const account = this.filteredAccounts.find(a => String(a.PK_ID) === String(accountId));
                if (account) {
                    this.openAccountDetailModal(account);
                }
            });
        });
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
     * Sync ownership from ShopWorks (Sales_Reps_2026 table)
     * This ensures the account list matches current ShopWorks assignments
     */
    async syncOwnership() {
        const btn = this.elements.syncOwnershipBtn;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Syncing...';
        }

        try {
            const result = await this.service.syncOwnership();

            if (result && result.success) {
                const { added, removed, unchanged } = result.summary;
                let message = `Ownership sync complete: ${added} added, ${removed} removed, ${unchanged} unchanged`;

                // Show detailed changes if any
                if (result.details.added.length > 0 || result.details.removed.length > 0) {
                    const addedNames = result.details.added.slice(0, 3).map(c => c.name).join(', ');
                    const removedNames = result.details.removed.slice(0, 3).map(c => c.name).join(', ');

                    if (addedNames) message += `\n\nAdded: ${addedNames}${result.details.added.length > 3 ? '...' : ''}`;
                    if (removedNames) message += `\n\nRemoved: ${removedNames}${result.details.removed.length > 3 ? '...' : ''}`;
                }

                this.showSuccess(message);

                // Reload accounts if there were changes
                if (added > 0 || removed > 0) {
                    await this.loadAccounts();
                    this.updateStats();
                    this.applyFilters();
                }
            } else {
                this.showError('Sync returned unexpected result');
            }

        } catch (error) {
            console.error('Ownership sync error:', error);
            this.showError('Ownership sync failed. Please try again later.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Sync from ShopWorks';
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
     * Show success message (using alert for now, can be enhanced with toast)
     */
    showSuccess(message) {
        // Use alert for simplicity - can be replaced with a toast component later
        alert(message);
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

    // ============================================================
    // ACCOUNT DETAIL MODAL METHODS
    // ============================================================

    /**
     * Open account detail modal
     */
    openAccountDetailModal(account) {
        if (!this.elements.accountDetailModalOverlay) return;

        // Set company name
        if (this.elements.accountDetailCompany) {
            this.elements.accountDetailCompany.textContent = account.CompanyName || 'Unknown Company';
        }

        // Set badges
        if (this.elements.accountDetailBadges) {
            this.elements.accountDetailBadges.innerHTML = this.renderAccountDetailBadges(account);
        }

        // Set body content
        if (this.elements.accountDetailBody) {
            this.elements.accountDetailBody.innerHTML = this.renderAccountDetailContent(account);
        }

        // Show modal
        this.elements.accountDetailModalOverlay.classList.add('active');
    }

    /**
     * Close account detail modal
     */
    closeAccountDetailModal() {
        if (this.elements.accountDetailModalOverlay) {
            this.elements.accountDetailModalOverlay.classList.remove('active');
        }
    }

    /**
     * Render account detail badges (tier, status)
     */
    renderAccountDetailBadges(account) {
        const tierInfo = this.service.getTierInfo(account.Account_Tier);
        const isAtRisk = account.At_Risk === true || account.At_Risk === 'true' || account.At_Risk === 1;
        const isOverdue = this.isOverdue(account);
        const healthClass = this.service.getHealthClass(account.Health_Score);
        const healthScore = Math.round(parseFloat(account.Health_Score) || 0);

        let badges = '';

        if (tierInfo.label) {
            badges += `<span class="tier-badge ${tierInfo.class}">${tierInfo.label}</span>`;
        }

        if (isAtRisk) {
            badges += '<span class="status-badge at-risk"><i class="fas fa-exclamation-triangle"></i> At Risk</span>';
        }

        if (isOverdue) {
            badges += '<span class="status-badge overdue"><i class="fas fa-clock"></i> Overdue</span>';
        }

        if (account.Trend) {
            const trendClass = (account.Trend || '').toLowerCase().includes('growing') ? 'growing' :
                              (account.Trend || '').toLowerCase().includes('declining') ? 'declining' : 'stable';
            badges += `<span class="trend-badge ${trendClass}">${this.escapeHtml(account.Trend)}</span>`;
        }

        // Health score gauge
        if (healthScore > 0) {
            badges += `
                <div class="health-gauge">
                    <div class="health-gauge-bar">
                        <div class="health-gauge-fill ${healthClass}" style="width: ${healthScore}%"></div>
                    </div>
                    <span class="health-gauge-value ${healthClass}">${healthScore}</span>
                </div>
            `;
        }

        return badges;
    }

    /**
     * Render account detail modal content
     */
    renderAccountDetailContent(account) {
        let html = '';

        // Section 2: Contact Information
        html += this.renderContactSection(account);

        // Section 3: Financial Summary
        html += this.renderFinancialSection(account);

        // Section 4: Year-over-Year Comparison
        html += this.renderYoYSection(account);

        // Section 5: Top Products
        html += this.renderTopProductsSection(account);

        // Section 6: Product Categories
        html += this.renderProductCategoriesSection(account);

        // Section 7: Order Types
        html += this.renderOrderTypesSection(account);

        // Section 8: Activity & Timing
        html += this.renderActivitySection(account);

        // Section 9: Monthly Activity
        html += this.renderMonthlyActivitySection(account);

        // Section 10: Notes & Follow-up
        html += this.renderNotesSection(account);

        return html;
    }

    /**
     * Render contact information section
     */
    renderContactSection(account) {
        const contactName = account.Main_Contact_Name;
        const email = account.Main_Contact_Email;
        const phone = account.Main_Contact_Phone;
        const lastContact = account.Last_Contact;
        const contactStatus = account.Contact_Status;

        if (!contactName && !email && !phone) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-user"></i> Contact Information</h4>
                <div class="contact-detail-grid">
                    ${contactName ? `
                        <div class="contact-detail-item">
                            <i class="fas fa-user"></i>
                            <span>${this.escapeHtml(contactName)}</span>
                        </div>
                    ` : ''}
                    ${email ? `
                        <div class="contact-detail-item">
                            <i class="fas fa-envelope"></i>
                            <a href="mailto:${this.escapeHtml(email)}">${this.escapeHtml(email)}</a>
                        </div>
                    ` : ''}
                    ${phone ? `
                        <div class="contact-detail-item">
                            <i class="fas fa-phone"></i>
                            <a href="tel:${this.escapeHtml(phone)}">${this.escapeHtml(phone)}</a>
                        </div>
                    ` : ''}
                    ${lastContact ? `
                        <div class="contact-detail-item">
                            <i class="fas fa-calendar-check"></i>
                            <span>Last Contact: ${this.formatDate(lastContact)}</span>
                        </div>
                    ` : ''}
                    ${contactStatus ? `
                        <div class="contact-detail-item">
                            <i class="fas fa-info-circle"></i>
                            <span>Status: ${this.escapeHtml(contactStatus)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render financial summary section
     */
    renderFinancialSection(account) {
        const totalRevenue = parseFloat(account.Total_Revenue) || 0;
        const totalProfit = parseFloat(account.Total_Profit) || 0;
        const marginPct = parseFloat(account.Margin_Pct) || 0;
        const avgOrderValue = parseFloat(account.Avg_Order_Value) || 0;
        const ordersPerYear = parseFloat(account.Orders_Per_Year) || 0;
        const yearsActive = parseFloat(account.Years_Active) || 0;

        if (!totalRevenue && !totalProfit && !avgOrderValue) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-chart-bar"></i> Financial Summary</h4>
                <div class="data-grid">
                    <div class="data-grid-item">
                        <div class="data-grid-value currency">${this.formatCurrency(totalRevenue)}</div>
                        <div class="data-grid-label">Total Revenue</div>
                    </div>
                    <div class="data-grid-item">
                        <div class="data-grid-value currency">${this.formatCurrency(totalProfit)}</div>
                        <div class="data-grid-label">Total Profit</div>
                    </div>
                    <div class="data-grid-item">
                        <div class="data-grid-value">${marginPct.toFixed(1)}%</div>
                        <div class="data-grid-label">Margin</div>
                    </div>
                    <div class="data-grid-item">
                        <div class="data-grid-value currency">${this.formatCurrency(avgOrderValue)}</div>
                        <div class="data-grid-label">Avg Order Value</div>
                    </div>
                    <div class="data-grid-item">
                        <div class="data-grid-value">${ordersPerYear.toFixed(1)}</div>
                        <div class="data-grid-label">Orders/Year</div>
                    </div>
                    <div class="data-grid-item">
                        <div class="data-grid-value">${yearsActive.toFixed(1)}</div>
                        <div class="data-grid-label">Years Active</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render year-over-year comparison section
     */
    renderYoYSection(account) {
        const revenue2024 = parseFloat(account.Revenue_2024) || 0;
        const revenue2025 = parseFloat(account.Revenue_2025) || 0;
        const profit2024 = parseFloat(account.Profit_2024) || 0;
        const profit2025 = parseFloat(account.Profit_2025) || 0;
        const yoyGrowth = parseFloat(account.YoY_Growth_Pct) || 0;

        if (!revenue2024 && !revenue2025) {
            return '';
        }

        const growthClass = yoyGrowth >= 0 ? 'positive' : 'negative';
        const growthSign = yoyGrowth >= 0 ? '+' : '';

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-chart-line"></i> Year-over-Year Comparison</h4>
                <div class="yoy-comparison">
                    <div class="yoy-card">
                        <div class="yoy-card-header">
                            <span class="yoy-card-year">2024</span>
                        </div>
                        <div class="yoy-card-values">
                            <div class="yoy-stat">
                                <div class="yoy-stat-value">${this.formatCurrency(revenue2024)}</div>
                                <div class="yoy-stat-label">Revenue</div>
                            </div>
                            <div class="yoy-stat">
                                <div class="yoy-stat-value">${this.formatCurrency(profit2024)}</div>
                                <div class="yoy-stat-label">Profit</div>
                            </div>
                        </div>
                    </div>
                    <div class="yoy-card">
                        <div class="yoy-card-header">
                            <span class="yoy-card-year">2025</span>
                            <span class="yoy-card-growth ${growthClass}">${growthSign}${yoyGrowth.toFixed(1)}%</span>
                        </div>
                        <div class="yoy-card-values">
                            <div class="yoy-stat">
                                <div class="yoy-stat-value">${this.formatCurrency(revenue2025)}</div>
                                <div class="yoy-stat-label">Revenue</div>
                            </div>
                            <div class="yoy-stat">
                                <div class="yoy-stat-value">${this.formatCurrency(profit2025)}</div>
                                <div class="yoy-stat-label">Profit</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render top products section
     */
    renderTopProductsSection(account) {
        const products = [
            account.Top_Product_1,
            account.Top_Product_2,
            account.Top_Product_3
        ].filter(p => p);

        if (products.length === 0) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-tshirt"></i> Top Products</h4>
                <div class="top-products-list">
                    ${products.map((product, i) => `
                        <div class="top-product-item">
                            <span class="top-product-rank">${i + 1}</span>
                            <span class="top-product-name">${this.escapeHtml(product)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render product categories section
     */
    renderProductCategoriesSection(account) {
        const categories = [
            { key: 'Buys_Caps', label: 'Caps' },
            { key: 'Buys_Jackets', label: 'Jackets' },
            { key: 'Buys_Carhartt', label: 'Carhartt' },
            { key: 'Buys_Polos', label: 'Polos' },
            { key: 'Buys_TShirts', label: 'T-Shirts' },
            { key: 'Buys_Hoodies', label: 'Hoodies' },
            { key: 'Buys_Safety', label: 'Safety' }
        ];

        const hasAny = categories.some(c => this.isTruthy(account[c.key]));
        if (!hasAny) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-tags"></i> Product Categories</h4>
                <div class="checkmark-grid">
                    ${categories.map(cat => {
                        const isActive = this.isTruthy(account[cat.key]);
                        return `
                            <div class="checkmark-item ${isActive ? 'active' : ''}">
                                <i class="fas ${isActive ? 'fa-check' : 'fa-times'}"></i>
                                <span>${cat.label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render order types section
     */
    renderOrderTypesSection(account) {
        const orderTypes = [
            { key: 'Uses_Inksoft', label: 'InkSoft' },
            { key: 'Uses_Custom_Embroidery', label: 'Custom Embroidery' },
            { key: 'Uses_Digital_Printing', label: 'Digital Printing' },
            { key: 'Uses_CAP_Order', label: 'CAP Order' },
            { key: 'Uses_DS_Embroidery', label: 'DS Embroidery' },
            { key: 'Uses_Transfers', label: 'Transfers' },
            { key: 'Uses_Screen_Print_Subcontract', label: 'Screen Print' },
            { key: 'Uses_HOT_TICKET', label: 'Hot Ticket' },
            { key: 'Uses_Laser_Ad_Specialties', label: 'Laser/Ad Spec' },
            { key: 'Uses_Blank_Goods', label: 'Blank Goods' }
        ];

        const hasAny = orderTypes.some(t => this.isTruthy(account[t.key]));
        const primaryType = account.Primary_Order_Type;

        if (!hasAny && !primaryType) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-clipboard-list"></i> Order Types</h4>
                ${primaryType ? `<p style="margin: 0 0 0.75rem; color: var(--text-secondary);"><strong>Primary:</strong> ${this.escapeHtml(primaryType)}</p>` : ''}
                <div class="checkmark-grid">
                    ${orderTypes.map(type => {
                        const isActive = this.isTruthy(account[type.key]);
                        return `
                            <div class="checkmark-item ${isActive ? 'active' : ''}">
                                <i class="fas ${isActive ? 'fa-check' : 'fa-times'}"></i>
                                <span>${type.label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render activity & timing section
     */
    renderActivitySection(account) {
        const firstOrder = account.First_Order;
        const lastOrder = account.Last_Order;
        const daysSinceLast = parseInt(account.Days_Since_Last_Order) || 0;
        const avgDaysBetween = parseFloat(account.Avg_Days_Between_Orders) || 0;
        const predictedNext = account.Predicted_Next_Order;
        const orderFrequency = account.Order_Frequency;

        if (!firstOrder && !lastOrder && !daysSinceLast) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-history"></i> Activity & Timing</h4>
                <div class="data-grid">
                    ${firstOrder ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${this.formatDate(firstOrder)}</div>
                            <div class="data-grid-label">First Order</div>
                        </div>
                    ` : ''}
                    ${lastOrder ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${this.formatDate(lastOrder)}</div>
                            <div class="data-grid-label">Last Order</div>
                        </div>
                    ` : ''}
                    ${daysSinceLast ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${daysSinceLast}</div>
                            <div class="data-grid-label">Days Since Last</div>
                        </div>
                    ` : ''}
                    ${avgDaysBetween ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${Math.round(avgDaysBetween)}</div>
                            <div class="data-grid-label">Avg Days Between</div>
                        </div>
                    ` : ''}
                    ${predictedNext ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${this.formatDate(predictedNext)}</div>
                            <div class="data-grid-label">Predicted Next</div>
                        </div>
                    ` : ''}
                    ${orderFrequency ? `
                        <div class="data-grid-item">
                            <div class="data-grid-value">${this.escapeHtml(orderFrequency)}</div>
                            <div class="data-grid-label">Frequency</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render monthly activity section
     */
    renderMonthlyActivitySection(account) {
        const months = [
            { key: 'Jan_Active', label: 'Jan' },
            { key: 'Feb_Active', label: 'Feb' },
            { key: 'Mar_Active', label: 'Mar' },
            { key: 'Apr_Active', label: 'Apr' },
            { key: 'May_Active', label: 'May' },
            { key: 'Jun_Active', label: 'Jun' },
            { key: 'Jul_Active', label: 'Jul' },
            { key: 'Aug_Active', label: 'Aug' },
            { key: 'Sep_Active', label: 'Sep' },
            { key: 'Oct_Active', label: 'Oct' },
            { key: 'Nov_Active', label: 'Nov' },
            { key: 'Dec_Active', label: 'Dec' }
        ];

        const primaryMonth = (account.Primary_Month || '').toLowerCase().substring(0, 3);
        const hasAny = months.some(m => this.isTruthy(account[m.key]));

        if (!hasAny && !primaryMonth) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-calendar-alt"></i> Monthly Activity</h4>
                <div class="monthly-activity-grid">
                    ${months.map(month => {
                        const isActive = this.isTruthy(account[month.key]);
                        const isPrimary = primaryMonth === month.label.toLowerCase();
                        let classes = 'month-box';
                        if (isPrimary) classes += ' primary';
                        else if (isActive) classes += ' active';
                        return `<div class="${classes}">${month.label}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render notes & follow-up section
     */
    renderNotesSection(account) {
        const notes = account.Contact_Notes;
        const nextFollowUp = account.Next_Follow_Up;
        const followUpType = account.Follow_Up_Type;
        const wonBackDate = account.Won_Back_Date;

        if (!notes && !nextFollowUp && !wonBackDate) {
            return '';
        }

        return `
            <div class="account-detail-section">
                <h4 class="account-detail-section-title"><i class="fas fa-sticky-note"></i> Notes & Follow-up</h4>
                ${notes ? `<div class="notes-content">${this.escapeHtml(notes)}</div>` : ''}
                ${(nextFollowUp || wonBackDate) ? `
                    <div class="follow-up-info">
                        ${nextFollowUp ? `
                            <div class="follow-up-item">
                                <i class="fas fa-calendar"></i>
                                <span>Next Follow-up: ${this.formatDate(nextFollowUp)}${followUpType ? ` (${this.escapeHtml(followUpType)})` : ''}</span>
                            </div>
                        ` : ''}
                        ${wonBackDate ? `
                            <div class="follow-up-item won-back">
                                <i class="fas fa-trophy"></i>
                                <span>Won Back: ${this.formatDate(wonBackDate)}</span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Helper to check if a value is truthy (handles 'true', 1, true)
     */
    isTruthy(value) {
        return value === true || value === 'true' || value === 1 || value === '1';
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
