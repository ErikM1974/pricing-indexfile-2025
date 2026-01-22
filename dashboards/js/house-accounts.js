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
        // Use APP_CONFIG if available, otherwise fallback
        this.baseURL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        this.accounts = [];
        this.stats = null;
        this.filters = {
            search: '',
            assignedTo: ''
        };
    }

    /**
     * Fetch all House accounts with optional filters
     */
    async fetchAccounts(filters = {}) {
        const params = new URLSearchParams();

        if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
        if (filters.search) params.append('search', filters.search);

        const url = `${this.baseURL}/api/house-accounts${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url);

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
        const response = await fetch(`${this.baseURL}/api/house-accounts/stats`);

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
            ? '/api/taneisha-accounts'
            : '/api/nika-accounts';

        // 1. Create in rep's table with Win-Back tier
        const createResponse = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ID_Customer: account.ID_Customer,
                CompanyName: account.CompanyName,
                Account_Tier: `Win Back '26 ${repName.toUpperCase()}`
            })
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create account in ${repName}'s table: ${createResponse.status} - ${errorText}`);
        }

        // 2. Delete from House table
        const deleteResponse = await fetch(`${this.baseURL}/api/house-accounts/${account.ID_Customer}`, {
            method: 'DELETE'
        });

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

            // Confirmation Modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmAccountPreview: document.getElementById('confirm-account-preview'),
            confirmClose: document.getElementById('confirm-close'),
            confirmCancel: document.getElementById('confirm-cancel'),
            confirmSubmit: document.getElementById('confirm-submit'),

            // Toast
            celebrationToast: document.getElementById('celebration-toast')
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeConfirmModal();
            }
        });
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
        this.service.filters.assignedTo = this.elements.assigneeSelect?.value || '';
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
            const notes = account.Notes || '';

            return `
                <div class="account-card" data-id="${account.ID_Customer}">
                    <div class="account-card-content">
                        <div class="card-header">
                            <div>
                                <h3 class="company-name">${this.escapeHtml(account.CompanyName)}</h3>
                            </div>
                            <span class="current-assignee">
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

                        ${notes ? `
                            <div class="account-notes">
                                <div class="account-notes-label">Notes</div>
                                ${this.escapeHtml(notes)}
                            </div>
                        ` : ''}

                        <div class="assign-buttons">
                            <button class="assign-btn taneisha" onclick="houseController.promptAssign('${account.ID_Customer}', 'Taneisha')">
                                <i class="fas fa-user-plus"></i> Taneisha
                            </button>
                            <button class="assign-btn nika" onclick="houseController.promptAssign('${account.ID_Customer}', 'Nika')">
                                <i class="fas fa-user-plus"></i> Nika
                            </button>
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
    houseController.init();
});
