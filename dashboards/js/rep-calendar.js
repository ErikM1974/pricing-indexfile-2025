/**
 * Rep CRM Calendar (Config-Driven)
 * Calendar view for follow-up scheduling
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
 * - Monthly calendar view
 * - Follow-up dots with priority colors
 * - Day detail panel
 * - Call This Month side panel
 */

// ============================================================
// CALENDAR CLASS
// ============================================================

class RepCalendar {
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
        this.filteredAccounts = [];
        this.followUpsByDate = {};
        this.currentDate = new Date();
        this.selectedDate = null;
        this.activeTierFilter = 'all';

        // DOM elements
        this.elements = {};
    }

    /**
     * Initialize the calendar
     */
    async init() {
        this.cacheElements();
        this.bindEvents();

        try {
            await this.loadAccounts();
            this.applyTierFilter();
            this.renderCalendar();
            this.renderCallThisMonth();
        } catch (error) {
            this.showError('Unable to load calendar data. Please refresh the page.');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            calendarGrid: document.getElementById('calendar-grid'),
            monthTitle: document.getElementById('calendar-month-title'),
            prevBtn: document.getElementById('calendar-prev'),
            nextBtn: document.getElementById('calendar-next'),
            todayBtn: document.getElementById('calendar-today'),
            errorBanner: document.getElementById('error-banner'),
            errorMessage: document.getElementById('error-message'),

            // Stats
            statTotal: document.getElementById('stat-total'),
            statScheduled: document.getElementById('stat-scheduled'),
            statOverdue: document.getElementById('stat-overdue'),

            // Tier filter tabs
            tierFilterTabs: document.getElementById('tier-filter-tabs'),

            // Selected day detail (inline below calendar)
            selectedDayDetail: document.getElementById('selected-day-detail'),
            selectedDayDate: document.getElementById('selected-day-date'),
            selectedDayCount: document.getElementById('selected-day-count'),
            selectedDayContent: document.getElementById('selected-day-content'),

            // Call This Month panel
            callThisMonthPanel: document.getElementById('call-this-month-panel'),
            callThisMonthCount: document.getElementById('call-this-month-count'),
            callThisMonthSubtitle: document.getElementById('call-this-month-subtitle'),
            callThisMonthContent: document.getElementById('call-this-month-content')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Navigation
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.navigateMonth(-1));
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.navigateMonth(1));
        }
        if (this.elements.todayBtn) {
            this.elements.todayBtn.addEventListener('click', () => this.goToToday());
        }

        // Tier filter tabs
        if (this.elements.tierFilterTabs) {
            this.elements.tierFilterTabs.addEventListener('click', (e) => {
                const tab = e.target.closest('.tier-tab');
                if (tab) {
                    this.setTierFilter(tab.dataset.tier);
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDayDetail();
            }
            if (e.key === 'ArrowLeft') {
                this.navigateMonth(-1);
            }
            if (e.key === 'ArrowRight') {
                this.navigateMonth(1);
            }
        });
    }

    /**
     * Load accounts from API
     */
    async loadAccounts() {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        this.accounts = data.Result || data.accounts || data || [];

        // Group by follow-up date
        this.groupFollowUpsByDate();

        // Update stats
        this.updateStats();
    }

    /**
     * Group accounts by their Next_Follow_Up date
     */
    groupFollowUpsByDate() {
        this.followUpsByDate = {};

        this.accounts.forEach(account => {
            if (account.Next_Follow_Up) {
                const dateKey = account.Next_Follow_Up.split('T')[0];

                if (!this.followUpsByDate[dateKey]) {
                    this.followUpsByDate[dateKey] = [];
                }

                this.followUpsByDate[dateKey].push(account);
            }
        });

        // Sort each date's accounts by priority
        Object.keys(this.followUpsByDate).forEach(dateKey => {
            this.followUpsByDate[dateKey].sort((a, b) => {
                const priorityOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
                const aPriority = priorityOrder[a.Priority_Tier] || 5;
                const bPriority = priorityOrder[b.Priority_Tier] || 5;
                return aPriority - bPriority;
            });
        });
    }

    /**
     * Set tier filter and refresh view
     */
    setTierFilter(tier) {
        this.activeTierFilter = tier;

        // Update tab active states
        if (this.elements.tierFilterTabs) {
            this.elements.tierFilterTabs.querySelectorAll('.tier-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tier === tier);
            });
        }

        this.applyTierFilter();
        this.renderCalendar();

        // Hide selected day detail when filter changes
        if (this.elements.selectedDayDetail) {
            this.elements.selectedDayDetail.style.display = 'none';
        }
        this.selectedDate = null;
    }

    /**
     * Apply tier filter to accounts
     */
    applyTierFilter() {
        if (this.activeTierFilter === 'all') {
            this.filteredAccounts = [...this.accounts];
        } else {
            this.filteredAccounts = this.accounts.filter(account => {
                const tier = (account.Account_Tier || '').toLowerCase().replace(' ', '-');
                return tier.includes(this.activeTierFilter);
            });
        }

        // Rebuild followUpsByDate with filtered accounts
        this.followUpsByDate = {};
        this.filteredAccounts.forEach(account => {
            if (account.Next_Follow_Up) {
                const dateKey = account.Next_Follow_Up.split('T')[0];
                if (!this.followUpsByDate[dateKey]) {
                    this.followUpsByDate[dateKey] = [];
                }
                this.followUpsByDate[dateKey].push(account);
            }
        });

        // Sort by priority
        Object.keys(this.followUpsByDate).forEach(dateKey => {
            this.followUpsByDate[dateKey].sort((a, b) => {
                const priorityOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
                const aPriority = priorityOrder[a.Priority_Tier] || 5;
                const bPriority = priorityOrder[b.Priority_Tier] || 5;
                return aPriority - bPriority;
            });
        });

        this.updateStats();
    }

    /**
     * Check if account has a scheduled follow-up
     */
    hasScheduledFollowUp(account) {
        return account.Next_Follow_Up && account.Next_Follow_Up.trim() !== '';
    }

    /**
     * Get accounts to call this month
     */
    getCallThisMonthAccounts() {
        const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
        const monthAbbrev = currentMonth.substring(0, 3);

        return this.accounts
            .filter(account => {
                const primaryMonth = (account.Primary_Month || '').toLowerCase();
                return primaryMonth.startsWith(monthAbbrev);
            })
            .filter(account => !this.hasScheduledFollowUp(account))
            .sort((a, b) => {
                // At Risk first
                const aRisk = a.At_Risk ? 1 : 0;
                const bRisk = b.At_Risk ? 1 : 0;
                if (bRisk !== aRisk) return bRisk - aRisk;

                // Priority A->E
                const priorityOrder = { A: 1, B: 2, C: 3, D: 4, E: 5 };
                const aPri = priorityOrder[a.Priority_Tier] || 5;
                const bPri = priorityOrder[b.Priority_Tier] || 5;
                if (aPri !== bPri) return aPri - bPri;

                // Days since last order (most stale first)
                return (b.Days_Since_Last_Order || 0) - (a.Days_Since_Last_Order || 0);
            });
    }

    /**
     * Render Call This Month panel
     */
    renderCallThisMonth() {
        const accounts = this.getCallThisMonthAccounts();
        const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

        // Update count
        if (this.elements.callThisMonthCount) {
            this.elements.callThisMonthCount.textContent = accounts.length;
        }

        // Update subtitle
        if (this.elements.callThisMonthSubtitle) {
            this.elements.callThisMonthSubtitle.textContent = `Primary_Month = ${currentMonth}`;
        }

        // Render content
        if (this.elements.callThisMonthContent) {
            if (accounts.length === 0) {
                this.elements.callThisMonthContent.innerHTML = `
                    <div class="panel-empty">
                        <i class="fas fa-check-circle"></i>
                        <p>All accounts scheduled!</p>
                    </div>
                `;
            } else {
                this.elements.callThisMonthContent.innerHTML = accounts.map(account => {
                    const tierInfo = this.getTierInfo(account.Account_Tier);
                    const priority = (account.Priority_Tier || 'D').toUpperCase();
                    const priorityClass = `priority-${priority.toLowerCase()}`;
                    const daysSince = account.Days_Since_Last_Order || 0;

                    return `
                        <div class="call-item ${priorityClass}" data-id="${account.ID_Customer}">
                            <div class="call-item-header">
                                <span class="priority-indicator ${priorityClass}"></span>
                                <span class="call-item-company">${this.escapeHtml(account.CompanyName || account.Company_Name || 'Unknown Company')}</span>
                                ${tierInfo.label ? `<span class="tier-badge small ${tierInfo.class}">${tierInfo.label}</span>` : ''}
                            </div>
                            <div class="call-item-contact">
                                <i class="fas fa-user"></i>
                                <span>${this.escapeHtml(account.Main_Contact_Name || 'No contact')}</span>
                                ${account.Main_Contact_Phone ? `<a href="tel:${account.Main_Contact_Phone}" class="call-item-phone"><i class="fas fa-phone"></i> ${this.escapeHtml(account.Main_Contact_Phone)}</a>` : ''}
                            </div>
                            <div class="call-item-stats">
                                <span class="stat"><i class="fas fa-dollar-sign"></i> ${this.formatCurrency(account.YTD_Sales_2026 || 0)} YTD</span>
                                <span class="stat"><i class="fas fa-box"></i> ${account.Order_Count_2026 || 0} orders</span>
                            </div>
                            <div class="call-item-timing">
                                <span><i class="fas fa-calendar-alt"></i> Primary: ${account.Primary_Month || 'N/A'}</span>
                                <span>Last: ${daysSince > 0 ? `${daysSince}d ago` : 'N/A'}</span>
                            </div>
                            <div class="call-item-products">
                                ${this.getProductTags(account)}
                            </div>
                            <div class="call-item-meta">
                                ${account.Trend ? `<span class="trend-badge ${(account.Trend || '').toLowerCase()}">${account.Trend}</span>` : ''}
                                <span class="call-item-priority">Priority ${priority}</span>
                                ${account.At_Risk ? '<span class="call-item-risk">At Risk</span>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    /**
     * Update stats display
     */
    updateStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalScheduled = 0;
        let overdue = 0;

        Object.keys(this.followUpsByDate).forEach(dateKey => {
            const date = new Date(dateKey);
            const count = this.followUpsByDate[dateKey].length;

            totalScheduled += count;

            if (date < today) {
                overdue += count;
            }
        });

        if (this.elements.statTotal) {
            this.elements.statTotal.textContent = this.accounts.length;
        }
        if (this.elements.statScheduled) {
            this.elements.statScheduled.textContent = totalScheduled;
        }
        if (this.elements.statOverdue) {
            this.elements.statOverdue.textContent = overdue;
        }
    }

    /**
     * Navigate to a different month
     */
    navigateMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
    }

    /**
     * Go to today's date
     */
    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }

    /**
     * Render the calendar grid
     */
    renderCalendar() {
        if (!this.elements.calendarGrid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update month title
        if (this.elements.monthTitle) {
            const monthName = this.currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            this.elements.monthTitle.textContent = monthName;
        }

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        // Get today's date for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build calendar HTML
        let html = '';

        // Weekday headers
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            html += `<div class="calendar-weekday">${day}</div>`;
        });

        // Previous month days
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            const date = new Date(year, month - 1, day);
            html += this.renderCalendarDay(date, true);
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            html += this.renderCalendarDay(date, false);
        }

        // Next month days to fill grid
        const totalCells = startDayOfWeek + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            html += this.renderCalendarDay(date, true);
        }

        this.elements.calendarGrid.innerHTML = html;

        // Add click handlers
        this.elements.calendarGrid.querySelectorAll('.calendar-day').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const dateKey = dayEl.dataset.date;
                if (dateKey) {
                    this.showDayDetail(dateKey);
                }
            });
        });
    }

    /**
     * Render a single calendar day
     */
    renderCalendarDay(date, isOtherMonth) {
        const dateKey = date.toISOString().split('T')[0];
        const followUps = this.followUpsByDate[dateKey] || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = date.getTime() === today.getTime();
        const isOverdue = date < today && followUps.length > 0;

        let classes = ['calendar-day'];
        if (isOtherMonth) classes.push('other-month');
        if (isToday) classes.push('today');
        if (followUps.length > 0) classes.push('has-followups');
        if (isOverdue) classes.push('overdue');

        let html = `<div class="${classes.join(' ')}" data-date="${dateKey}">`;
        html += `<div class="calendar-day-number">${date.getDate()}</div>`;

        if (followUps.length > 0 && !isOtherMonth) {
            html += '<div class="calendar-followups">';

            // Show first 3 follow-ups
            const displayFollowUps = followUps.slice(0, 3);
            displayFollowUps.forEach(account => {
                const priority = (account.Priority_Tier || 'd').toLowerCase();
                html += `
                    <div class="calendar-followup-item priority-${priority}">
                        ${this.escapeHtml(account.CompanyName || account.Company_Name)}
                    </div>
                `;
            });

            // Show "+X more" if needed
            if (followUps.length > 3) {
                html += `<div class="calendar-more">+${followUps.length - 3} more</div>`;
            }

            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Show day detail panel (inline below calendar)
     */
    showDayDetail(dateKey) {
        this.selectedDate = dateKey;
        const followUps = this.followUpsByDate[dateKey] || [];

        // Format date for display
        const date = new Date(dateKey);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // Update inline selected day detail section
        if (this.elements.selectedDayDate) {
            this.elements.selectedDayDate.textContent = dateStr;
        }

        if (this.elements.selectedDayCount) {
            this.elements.selectedDayCount.textContent = `${followUps.length} scheduled`;
        }

        if (this.elements.selectedDayContent) {
            if (followUps.length === 0) {
                this.elements.selectedDayContent.innerHTML = `
                    <div class="empty-state" style="padding: 1.5rem; text-align: center;">
                        <i class="fas fa-calendar-day" style="font-size: 1.5rem; color: #d1d5db; margin-bottom: 0.5rem;"></i>
                        <p style="color: #6b7280; margin: 0;">No follow-ups scheduled for this day</p>
                    </div>
                `;
            } else {
                this.elements.selectedDayContent.innerHTML = followUps.map(account => {
                    const priority = (account.Priority_Tier || 'd').toLowerCase();
                    const followUpType = account.Follow_Up_Type || 'Call';
                    const tierInfo = this.getTierInfo(account.Account_Tier);

                    return `
                        <div class="selected-day-item priority-${priority}" data-id="${account.ID_Customer}">
                            <div class="selected-day-item-header">
                                <span class="priority-indicator priority-${priority}"></span>
                                <span class="selected-day-company">${this.escapeHtml(account.CompanyName || account.Company_Name)}</span>
                                ${tierInfo.label ? `<span class="tier-badge small ${tierInfo.class}">${tierInfo.label}</span>` : ''}
                            </div>
                            <div class="selected-day-info">
                                <div class="selected-day-contact">
                                    <i class="fas fa-user"></i> ${this.escapeHtml(account.Main_Contact_Name || 'No contact')}
                                </div>
                                ${account.Main_Contact_Phone ? `
                                    <div class="selected-day-phone">
                                        <a href="tel:${this.escapeHtml(account.Main_Contact_Phone)}">
                                            <i class="fas fa-phone"></i> ${this.escapeHtml(account.Main_Contact_Phone)}
                                        </a>
                                    </div>
                                ` : ''}
                                ${account.Main_Contact_Email ? `
                                    <div class="selected-day-email">
                                        <a href="mailto:${this.escapeHtml(account.Main_Contact_Email)}">
                                            <i class="fas fa-envelope"></i> ${this.escapeHtml(account.Main_Contact_Email)}
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="selected-day-type">
                                <i class="fas fa-${this.getFollowUpIcon(followUpType)}"></i>
                                ${followUpType}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Show inline detail section
        if (this.elements.selectedDayDetail) {
            this.elements.selectedDayDetail.style.display = 'block';
        }
    }

    /**
     * Close day detail panel
     */
    closeDayDetail() {
        if (this.elements.selectedDayDetail) {
            this.elements.selectedDayDetail.style.display = 'none';
        }
        this.selectedDate = null;
    }

    /**
     * Get icon for follow-up type
     */
    getFollowUpIcon(type) {
        const icons = {
            'Call': 'phone',
            'Email': 'envelope',
            'Visit': 'car',
            'Quote': 'file-invoice-dollar'
        };
        return icons[type] || 'calendar-check';
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
     * Format currency for display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(amount);
    }

    /**
     * Get product tags HTML for an account
     */
    getProductTags(account) {
        const products = [];
        if (account.Buys_Caps) products.push('Caps');
        if (account.Buys_Jackets) products.push('Jackets');
        if (account.Buys_Carhartt) products.push('Carhartt');
        if (account.Buys_Polos) products.push('Polos');
        if (account.Buys_TShirts) products.push('T-Shirts');
        if (account.Buys_Hoodies) products.push('Hoodies');
        if (account.Buys_Safety) products.push('Safety');

        if (products.length === 0) {
            return '<span class="no-products">No product history</span>';
        }
        return products.map(p => `<span class="product-chip">${p}</span>`).join('');
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
    window.calendarController = new RepCalendar();
    window.calendarController.init();
});
