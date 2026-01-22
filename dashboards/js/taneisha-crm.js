/**
 * Taneisha CRM Dashboard
 * Service class and controller for account management
 *
 * Features:
 * - Account list with filters
 * - CRM modal for contact logging
 * - Today's Call List with sequential calling mode
 * - Gamification: streaks, bounty tracker, smart suggestions
 * - Sales sync integration
 */

// ============================================================
// SERVICE CLASS
// ============================================================

class TaneishaCRMService {
    constructor() {
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

        const url = `${this.baseURL}/api/taneisha-accounts${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.accounts = data.Result || data.accounts || data || [];

        // Debug: Log first account structure to verify field names
        if (this.accounts.length > 0) {
            console.log('[TaneishaCRM] Sample account fields:', Object.keys(this.accounts[0]));
            console.log('[TaneishaCRM] First account:', this.accounts[0]);
        }

        return this.accounts;
    }

    /**
     * Fetch a single account by ID
     */
    async fetchAccountById(id) {
        const response = await fetch(`${this.baseURL}/api/taneisha-accounts/${id}`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.selectedAccount = data.Result ? data.Result[0] : data;

        return this.selectedAccount;
    }

    /**
     * Update CRM fields for an account
     */
    async updateCRMFields(id, crmData) {
        const response = await fetch(`${this.baseURL}/api/taneisha-accounts/${id}/crm`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(crmData)
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Sync sales from ManageOrders
     */
    async syncSales() {
        const response = await fetch(`${this.baseURL}/api/taneisha-accounts/sync-sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Calculate stats from loaded accounts
     */
    calculateStats() {
        const stats = {
            total: 0,
            goldTier: 0,
            winBack: 0,
            atRisk: 0,
            overdue: 0,
            ytdRevenue: 0,
            bountyEarned: 0,
            bountyPotential: 0
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.accounts.forEach(account => {
            stats.total++;

            // Tier counts
            const tier = (account.Account_Tier || '').toUpperCase();
            if (tier.includes('GOLD')) stats.goldTier++;
            if (tier.includes('WIN BACK')) {
                stats.winBack++;
                // Calculate potential bounty (10% of avg annual profit)
                const avgProfit = parseFloat(account.Avg_Annual_Profit) || 0;
                stats.bountyPotential += avgProfit * 0.10;

                // If won back, calculate earned bounty from sales since won back date
                if (account.Won_Back_Date) {
                    const ytdSales = parseFloat(account.YTD_Sales_2026) || 0;
                    stats.bountyEarned += ytdSales * 0.10;
                }
            }

            // At Risk flag
            if (account.At_Risk === true || account.At_Risk === 'true' || account.At_Risk === 1) {
                stats.atRisk++;
            }

            // Overdue check (Next_Follow_Up in the past)
            if (account.Next_Follow_Up) {
                const followUpDate = new Date(account.Next_Follow_Up);
                followUpDate.setHours(0, 0, 0, 0);
                if (followUpDate < today) {
                    stats.overdue++;
                }
            }

            // YTD Revenue
            stats.ytdRevenue += parseFloat(account.YTD_Sales_2026) || 0;
        });

        return stats;
    }

    /**
     * Get today's call list
     * Includes: scheduled follow-ups for today, overdue, and accounts in current month
     */
    getTodaysCallList() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const currentMonth = today.toLocaleString('en-US', { month: 'short' }).toLowerCase();

        const callList = {
            scheduled: [],
            overdue: [],
            monthMatch: [],
            all: []
        };

        this.accounts.forEach(account => {
            let reason = null;

            // Check if scheduled for today
            if (account.Next_Follow_Up) {
                const followUpDate = new Date(account.Next_Follow_Up);
                followUpDate.setHours(0, 0, 0, 0);

                if (followUpDate.getTime() === today.getTime()) {
                    reason = 'scheduled';
                    callList.scheduled.push({ ...account, callReason: reason });
                } else if (followUpDate < today) {
                    reason = 'overdue';
                    callList.overdue.push({ ...account, callReason: reason });
                }
            }

            // Check if primary month matches current month and not already contacted
            if (!reason && account.Primary_Month) {
                const primaryMonth = account.Primary_Month.toLowerCase().substring(0, 3);
                if (primaryMonth === currentMonth && !this.wasContactedThisMonth(account)) {
                    reason = 'month';
                    callList.monthMatch.push({ ...account, callReason: reason });
                }
            }
        });

        // Combine all lists with priority: scheduled > overdue > month
        callList.all = [
            ...callList.scheduled,
            ...callList.overdue,
            ...callList.monthMatch
        ];

        return callList;
    }

    /**
     * Check if account was contacted this month
     */
    wasContactedThisMonth(account) {
        if (!account.Last_Contact_Date) return false;

        const contactDate = new Date(account.Last_Contact_Date);
        const now = new Date();

        return contactDate.getMonth() === now.getMonth() &&
               contactDate.getFullYear() === now.getFullYear();
    }

    /**
     * Get smart suggestions for calling
     */
    getSmartSuggestions(limit = 5) {
        const suggestions = [];
        const today = new Date();

        this.accounts.forEach(account => {
            let score = 0;
            let reason = '';

            // At Risk accounts get highest priority
            if (account.At_Risk === true || account.At_Risk === 'true' || account.At_Risk === 1) {
                score += 100;
                reason = 'At Risk';
            }

            // Days since last contact
            if (account.Last_Contact_Date) {
                const lastContact = new Date(account.Last_Contact_Date);
                const daysSince = Math.floor((today - lastContact) / (1000 * 60 * 60 * 24));
                if (daysSince >= 30) {
                    score += Math.min(daysSince, 90); // Cap at 90 days
                    if (!reason) reason = `${daysSince} days ago`;
                }
            } else {
                score += 50; // Never contacted
                if (!reason) reason = 'Never contacted';
            }

            // Account value
            const avgProfit = parseFloat(account.Avg_Annual_Profit) || 0;
            if (avgProfit >= 5000) {
                score += 30;
                if (!reason) reason = `$${(avgProfit / 1000).toFixed(1)}K value`;
            }

            // Priority tier bonus
            const priority = (account.Priority_Tier || '').toUpperCase();
            if (priority === 'A') score += 20;
            else if (priority === 'B') score += 10;

            if (score > 0) {
                suggestions.push({
                    account,
                    score,
                    reason,
                    priority: score >= 100 ? 'high' : score >= 50 ? 'medium' : 'low'
                });
            }
        });

        // Sort by score descending and limit
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Get call streak data
     */
    getStreakData() {
        // This would typically come from the backend
        // For now, we'll calculate from accounts' Last_Contact_Date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let callsToday = 0;
        let callsThisWeek = 0;
        let streakDays = 0;

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        // Count calls for streak calculation
        const callsByDay = {};

        this.accounts.forEach(account => {
            if (account.Last_Contact_Date) {
                const contactDate = new Date(account.Last_Contact_Date);
                contactDate.setHours(0, 0, 0, 0);

                const dateKey = contactDate.toISOString().split('T')[0];
                callsByDay[dateKey] = (callsByDay[dateKey] || 0) + 1;

                if (contactDate.getTime() === today.getTime()) {
                    callsToday++;
                }

                if (contactDate >= startOfWeek) {
                    callsThisWeek++;
                }
            }
        });

        // Calculate streak (consecutive days with 5+ calls)
        let checkDate = new Date(today);
        while (true) {
            const dateKey = checkDate.toISOString().split('T')[0];
            if (callsByDay[dateKey] && callsByDay[dateKey] >= 5) {
                streakDays++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return {
            streakDays,
            callsToday,
            callsThisWeek
        };
    }

    /**
     * Filter accounts client-side
     */
    filterAccounts(filters) {
        return this.accounts.filter(account => {
            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const companyName = (account.CompanyName || '').toLowerCase();
                if (!companyName.includes(searchTerm)) {
                    return false;
                }
            }

            // Tier filter
            if (filters.accountTier) {
                const tier = (account.Account_Tier || '').toUpperCase();
                if (!tier.includes(filters.accountTier.toUpperCase())) {
                    return false;
                }
            }

            // Priority filter
            if (filters.priorityTier) {
                if (account.Priority_Tier !== filters.priorityTier) {
                    return false;
                }
            }

            // Month filter
            if (filters.month) {
                const primaryMonth = (account.Primary_Month || '').toLowerCase();
                if (!primaryMonth.startsWith(filters.month.toLowerCase())) {
                    return false;
                }
            }

            // Trend filter
            if (filters.trend) {
                const trend = (account.Trend || '').toLowerCase();
                if (!trend.includes(filters.trend.toLowerCase())) {
                    return false;
                }
            }

            // At Risk filter
            if (filters.atRisk) {
                if (account.At_Risk !== true && account.At_Risk !== 'true' && account.At_Risk !== 1) {
                    return false;
                }
            }

            // Product filters
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

class TaneishaCRMController {
    constructor() {
        this.service = new TaneishaCRMService();

        // DOM elements
        this.elements = {};

        // State
        this.filteredAccounts = [];
        this.callingModeAccounts = [];
        this.callingModeIndex = 0;
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
            this.updateCallList();
            this.updateGamification();
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

            // Call list
            callListCount: document.getElementById('call-list-count'),
            callListScheduled: document.getElementById('call-list-scheduled'),
            callListOverdue: document.getElementById('call-list-overdue'),
            callListMonth: document.getElementById('call-list-month'),
            startCallingBtn: document.getElementById('start-calling-btn'),

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

            // Gamification
            streakNumber: document.getElementById('streak-number'),
            streakCalls: document.getElementById('streak-calls'),
            bountyEarned: document.getElementById('bounty-earned'),
            bountyPotential: document.getElementById('bounty-potential'),
            bountyWonBack: document.getElementById('bounty-won-back'),
            bountyProgress: document.getElementById('bounty-progress'),
            suggestionsList: document.getElementById('suggestions-list'),

            // Modal
            modalOverlay: document.getElementById('crm-modal-overlay'),
            modalCompanyName: document.getElementById('modal-company-name'),
            modalTierBadge: document.getElementById('modal-tier-badge'),
            modalProductTags: document.getElementById('modal-product-tags'),
            formContactDate: document.getElementById('form-contact-date'),
            formContactStatus: document.getElementById('form-contact-status'),
            formContactNotes: document.getElementById('form-contact-notes'),
            formFollowUpDate: document.getElementById('form-follow-up-date'),
            formFollowUpType: document.getElementById('form-follow-up-type'),
            formWonBackDate: document.getElementById('form-won-back-date'),
            wonBackGroup: document.getElementById('won-back-group'),
            saveBtn: document.getElementById('save-btn'),
            cancelBtn: document.getElementById('cancel-btn'),
            modalClose: document.getElementById('modal-close'),

            // Calling mode
            callingModeOverlay: document.getElementById('calling-mode-overlay'),
            callingModeProgress: document.getElementById('calling-mode-progress'),
            callingModeCompany: document.getElementById('calling-mode-company'),
            callingModeContact: document.getElementById('calling-mode-contact'),
            callingModePhone: document.getElementById('calling-mode-phone'),
            callingModeLogBtn: document.getElementById('calling-mode-log'),
            callingModeSkipBtn: document.getElementById('calling-mode-skip'),
            callingModeExitBtn: document.getElementById('calling-mode-exit'),

            // Sync
            syncBtn: document.getElementById('sync-btn'),
            syncStatus: document.getElementById('sync-status'),
            lastSynced: document.getElementById('last-synced')
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

        // Start calling
        if (this.elements.startCallingBtn) {
            this.elements.startCallingBtn.addEventListener('click', () => this.startCallingMode());
        }

        // Modal events
        if (this.elements.modalClose) {
            this.elements.modalClose.addEventListener('click', () => this.closeModal());
        }
        if (this.elements.cancelBtn) {
            this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => this.saveCRMData());
        }
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.modalOverlay) {
                    this.closeModal();
                }
            });
        }

        // Contact status change (show/hide Won Back Date)
        if (this.elements.formContactStatus) {
            this.elements.formContactStatus.addEventListener('change', (e) => {
                const showWonBack = e.target.value === 'Won Back';
                if (this.elements.wonBackGroup) {
                    this.elements.wonBackGroup.style.display = showWonBack ? 'block' : 'none';
                }
            });
        }

        // Calling mode events
        if (this.elements.callingModeLogBtn) {
            this.elements.callingModeLogBtn.addEventListener('click', () => this.logCallAndAdvance());
        }
        if (this.elements.callingModeSkipBtn) {
            this.elements.callingModeSkipBtn.addEventListener('click', () => this.skipToNextCall());
        }
        if (this.elements.callingModeExitBtn) {
            this.elements.callingModeExitBtn.addEventListener('click', () => this.exitCallingMode());
        }

        // Sync button
        if (this.elements.syncBtn) {
            this.elements.syncBtn.addEventListener('click', () => this.syncSales());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.exitCallingMode();
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
        // Reset filter values
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        if (this.elements.tierSelect) this.elements.tierSelect.value = '';
        if (this.elements.prioritySelect) this.elements.prioritySelect.value = '';
        if (this.elements.monthSelect) this.elements.monthSelect.value = '';
        if (this.elements.trendSelect) this.elements.trendSelect.value = '';

        // Clear product toggles
        this.elements.productToggles.forEach(toggle => {
            toggle.classList.remove('active');
        });

        // Clear quick action states
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Reset service filters
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

        // Update filter state
        if (filterType === 'atRisk') {
            this.service.filters.atRisk = isActive;
        } else if (filterType === 'overdue') {
            this.service.filters.overdue = isActive;
        } else if (filterType === 'callMonth') {
            // Filter by current month
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
    }

    /**
     * Update call list panel
     */
    updateCallList() {
        const callList = this.service.getTodaysCallList();

        if (this.elements.callListCount) {
            this.elements.callListCount.textContent = callList.all.length;
        }
        if (this.elements.callListScheduled) {
            this.elements.callListScheduled.textContent = callList.scheduled.length;
        }
        if (this.elements.callListOverdue) {
            this.elements.callListOverdue.textContent = callList.overdue.length;
        }
        if (this.elements.callListMonth) {
            this.elements.callListMonth.textContent = callList.monthMatch.length;
        }

        // Store for calling mode
        this.callingModeAccounts = callList.all;
    }

    /**
     * Update gamification sidebar
     */
    updateGamification() {
        // Update streak
        const streakData = this.service.getStreakData();
        if (this.elements.streakNumber) {
            this.elements.streakNumber.textContent = streakData.streakDays;
        }
        if (this.elements.streakCalls) {
            this.elements.streakCalls.textContent = `${streakData.callsThisWeek} calls this week`;
        }

        // Update bounty tracker
        const stats = this.service.calculateStats();
        if (this.elements.bountyEarned) {
            this.elements.bountyEarned.textContent = this.formatCurrency(stats.bountyEarned);
        }
        if (this.elements.bountyPotential) {
            this.elements.bountyPotential.textContent = this.formatCurrency(stats.bountyPotential);
        }
        if (this.elements.bountyProgress) {
            const percentage = stats.bountyPotential > 0
                ? (stats.bountyEarned / stats.bountyPotential) * 100
                : 0;
            this.elements.bountyProgress.style.width = `${Math.min(percentage, 100)}%`;
        }

        // Update smart suggestions
        this.updateSmartSuggestions();
    }

    /**
     * Update smart suggestions list
     */
    updateSmartSuggestions() {
        if (!this.elements.suggestionsList) return;

        const suggestions = this.service.getSmartSuggestions(5);

        this.elements.suggestionsList.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" data-id="${suggestion.account.PK_ID}">
                <div class="suggestion-priority ${suggestion.priority}"></div>
                <div class="suggestion-info">
                    <div class="suggestion-company">${this.escapeHtml(suggestion.account.CompanyName)}</div>
                    <div class="suggestion-reason">${this.escapeHtml(suggestion.reason)}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers
        this.elements.suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.openModal(item.dataset.id);
            });
        });
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

        // Add click handlers to cards
        this.elements.accountsGrid.querySelectorAll('.account-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openModal(card.dataset.id);
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
     * Open CRM modal for an account
     */
    async openModal(accountId) {
        try {
            const account = await this.service.fetchAccountById(accountId);

            if (!account) {
                this.showError('Account not found.');
                return;
            }

            // Populate modal
            if (this.elements.modalCompanyName) {
                this.elements.modalCompanyName.textContent = account.CompanyName;
            }

            // Update tier badge
            if (this.elements.modalTierBadge) {
                const tierInfo = this.service.getTierInfo(account.Account_Tier);
                if (tierInfo.label) {
                    this.elements.modalTierBadge.className = `tier-badge ${tierInfo.class}`;
                    this.elements.modalTierBadge.textContent = tierInfo.label;
                    this.elements.modalTierBadge.style.display = 'inline-flex';
                } else {
                    this.elements.modalTierBadge.style.display = 'none';
                }
            }

            // Update product tags
            if (this.elements.modalProductTags) {
                const products = [];
                if (account.Buys_Carhartt) products.push('Carhartt');
                if (account.Buys_Jackets) products.push('Jackets');
                if (account.Buys_Caps) products.push('Caps');

                this.elements.modalProductTags.innerHTML = products.map(p =>
                    `<span class="product-tag active">${p}</span>`
                ).join('');
            }

            // Populate form fields
            if (this.elements.formContactDate) {
                this.elements.formContactDate.value = new Date().toISOString().split('T')[0];
            }
            if (this.elements.formContactStatus) {
                this.elements.formContactStatus.value = account.Contact_Status || '';
            }
            if (this.elements.formContactNotes) {
                this.elements.formContactNotes.value = account.Contact_Notes || '';
            }
            if (this.elements.formFollowUpDate) {
                this.elements.formFollowUpDate.value = account.Next_Follow_Up
                    ? account.Next_Follow_Up.split('T')[0]
                    : '';
            }
            if (this.elements.formFollowUpType) {
                this.elements.formFollowUpType.value = account.Follow_Up_Type || '';
            }
            if (this.elements.formWonBackDate) {
                this.elements.formWonBackDate.value = account.Won_Back_Date
                    ? account.Won_Back_Date.split('T')[0]
                    : '';
            }

            // Show/hide Won Back date field
            if (this.elements.wonBackGroup) {
                this.elements.wonBackGroup.style.display =
                    account.Contact_Status === 'Won Back' ? 'block' : 'none';
            }

            // Store account ID for save
            if (this.elements.saveBtn) {
                this.elements.saveBtn.dataset.accountId = accountId;
            }

            // Show modal
            if (this.elements.modalOverlay) {
                this.elements.modalOverlay.classList.add('active');
            }

        } catch (error) {
            this.showError('Unable to load account details. Please try again.');
        }
    }

    /**
     * Close CRM modal
     */
    closeModal() {
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.remove('active');
        }
    }

    /**
     * Save CRM data from modal
     */
    async saveCRMData() {
        const accountId = this.elements.saveBtn?.dataset.accountId;
        if (!accountId) return;

        const crmData = {
            Last_Contact_Date: this.elements.formContactDate?.value || null,
            Contact_Status: this.elements.formContactStatus?.value || null,
            Contact_Notes: this.elements.formContactNotes?.value || null,
            Next_Follow_Up: this.elements.formFollowUpDate?.value || null,
            Follow_Up_Type: this.elements.formFollowUpType?.value || null
        };

        // Add Won Back Date if status is "Won Back"
        if (crmData.Contact_Status === 'Won Back' && this.elements.formWonBackDate?.value) {
            crmData.Won_Back_Date = this.elements.formWonBackDate.value;
        }

        // Disable save button
        if (this.elements.saveBtn) {
            this.elements.saveBtn.disabled = true;
            this.elements.saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
        }

        try {
            await this.service.updateCRMFields(accountId, crmData);

            // Close modal
            this.closeModal();

            // Show success celebration if Won Back
            if (crmData.Contact_Status === 'Won Back') {
                this.showCelebration(`You won back ${this.service.selectedAccount.CompanyName}!`, 'winback');
            }

            // Reload accounts to refresh data
            await this.loadAccounts();
            this.updateStats();
            this.updateCallList();
            this.updateGamification();
            this.applyFilters();

        } catch (error) {
            this.showError('Failed to save. Please try again.');
        } finally {
            if (this.elements.saveBtn) {
                this.elements.saveBtn.disabled = false;
                this.elements.saveBtn.innerHTML = 'Save';
            }
        }
    }

    /**
     * Start sequential calling mode
     */
    startCallingMode() {
        if (this.callingModeAccounts.length === 0) {
            this.showError('No accounts to call today.');
            return;
        }

        this.callingModeIndex = 0;
        this.showCallingModeAccount();

        if (this.elements.callingModeOverlay) {
            this.elements.callingModeOverlay.classList.add('active');
        }
    }

    /**
     * Show current account in calling mode
     */
    showCallingModeAccount() {
        const account = this.callingModeAccounts[this.callingModeIndex];
        if (!account) {
            this.exitCallingMode();
            return;
        }

        if (this.elements.callingModeProgress) {
            this.elements.callingModeProgress.textContent =
                `${this.callingModeIndex + 1} of ${this.callingModeAccounts.length}`;
        }
        if (this.elements.callingModeCompany) {
            this.elements.callingModeCompany.textContent = account.CompanyName;
        }
        if (this.elements.callingModeContact) {
            this.elements.callingModeContact.textContent = account.Main_Contact_Name || 'No contact name';
        }
        if (this.elements.callingModePhone) {
            const phone = account.Main_Contact_Phone || 'No phone';
            this.elements.callingModePhone.innerHTML = account.Main_Contact_Phone
                ? `<a href="tel:${this.escapeHtml(phone)}">${this.escapeHtml(phone)}</a>`
                : phone;
        }
    }

    /**
     * Log call and advance to next account
     */
    async logCallAndAdvance() {
        const account = this.callingModeAccounts[this.callingModeIndex];
        if (!account) return;

        // Quick log as "Called"
        const crmData = {
            Last_Contact_Date: new Date().toISOString().split('T')[0],
            Contact_Status: 'Called'
        };

        try {
            await this.service.updateCRMFields(account.PK_ID, crmData);
        } catch (error) {
            // Continue even on error
        }

        this.skipToNextCall();
    }

    /**
     * Skip to next account without logging
     */
    skipToNextCall() {
        this.callingModeIndex++;

        if (this.callingModeIndex >= this.callingModeAccounts.length) {
            this.exitCallingMode();
            this.showCelebration('All calls completed for today!', 'calls');
        } else {
            this.showCallingModeAccount();
        }
    }

    /**
     * Exit calling mode
     */
    exitCallingMode() {
        if (this.elements.callingModeOverlay) {
            this.elements.callingModeOverlay.classList.remove('active');
        }

        // Refresh data
        this.loadAccounts().then(() => {
            this.updateStats();
            this.updateCallList();
            this.updateGamification();
            this.applyFilters();
        });
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
            this.updateGamification();
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
     * Show celebration toast
     */
    showCelebration(message, type = 'winback') {
        const toast = document.createElement('div');
        toast.className = `celebration-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after delay
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
     * Format days as human-readable duration (e.g., "3y 2m 16d")
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
    window.crmController = new TaneishaCRMController();
    window.crmController.init();
});
