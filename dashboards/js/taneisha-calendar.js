/**
 * Taneisha CRM Calendar
 * Calendar view for follow-up scheduling
 *
 * Features:
 * - Monthly calendar view
 * - Follow-up dots with priority colors
 * - Day detail panel
 * - Click to open CRM modal
 */

// ============================================================
// CALENDAR CLASS
// ============================================================

class TaneishaCalendar {
    constructor() {
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
            dayDetailPanel: document.getElementById('day-detail-panel'),
            dayDetailDate: document.getElementById('day-detail-date'),
            dayDetailContent: document.getElementById('day-detail-content'),
            dayDetailClose: document.getElementById('day-detail-close'),
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
            callThisMonthContent: document.getElementById('call-this-month-content'),

            // Modal elements
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
            modalClose: document.getElementById('modal-close')
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

        // Day detail panel
        if (this.elements.dayDetailClose) {
            this.elements.dayDetailClose.addEventListener('click', () => this.closeDayDetail());
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

        // Contact status change
        if (this.elements.formContactStatus) {
            this.elements.formContactStatus.addEventListener('change', (e) => {
                const showWonBack = e.target.value === 'Won Back';
                if (this.elements.wonBackGroup) {
                    this.elements.wonBackGroup.style.display = showWonBack ? 'block' : 'none';
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDayDetail();
                this.closeModal();
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
        const response = await fetch(`${this.baseURL}/api/taneisha-accounts`);

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

                // Priority A→E
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
                            <button class="schedule-btn" data-id="${account.ID_Customer}">
                                <i class="fas fa-calendar-plus"></i> Schedule
                            </button>
                        </div>
                    `;
                }).join('');

                // Bind schedule button events
                this.elements.callThisMonthContent.querySelectorAll('.schedule-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openScheduleModal(btn.dataset.id);
                    });
                });

                // Bind click on item to open CRM modal
                this.elements.callThisMonthContent.querySelectorAll('.call-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.openModal(item.dataset.id);
                    });
                });
            }
        }
    }

    /**
     * Open schedule modal for quick follow-up scheduling
     */
    openScheduleModal(accountId) {
        const account = this.accounts.find(a => String(a.ID_Customer) === String(accountId));
        if (!account) return;

        // For now, open the full CRM modal with focus on follow-up date
        this.openModal(accountId);

        // After modal opens, focus on the follow-up date field
        setTimeout(() => {
            if (this.elements.formFollowUpDate) {
                this.elements.formFollowUpDate.focus();
            }
        }, 100);
    }

    /**
     * Quick schedule follow-up
     */
    async scheduleFollowUp(accountId, date, type = 'Call') {
        try {
            const response = await fetch(`${this.baseURL}/api/taneisha-accounts/${accountId}/crm`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Next_Follow_Up: date,
                    Follow_Up_Type: type
                })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            // Reload data and refresh
            await this.loadAccounts();
            this.applyTierFilter();
            this.renderCalendar();
            this.renderCallThisMonth();

        } catch (error) {
            this.showError('Failed to schedule follow-up. Please try again.');
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

                // Add click handlers
                this.elements.selectedDayContent.querySelectorAll('.selected-day-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.openModal(item.dataset.id);
                    });
                });
            }
        }

        // Show inline detail section
        if (this.elements.selectedDayDetail) {
            this.elements.selectedDayDetail.style.display = 'block';
        }

        // Also update the side panel (legacy)
        if (this.elements.dayDetailDate) {
            this.elements.dayDetailDate.textContent = dateStr;
        }

        if (this.elements.dayDetailContent) {
            if (followUps.length === 0) {
                this.elements.dayDetailContent.innerHTML = `
                    <div class="empty-state" style="padding: 2rem; text-align: center;">
                        <i class="fas fa-calendar-day" style="font-size: 2rem; color: #d1d5db; margin-bottom: 1rem;"></i>
                        <p style="color: #6b7280;">No follow-ups scheduled for this day</p>
                    </div>
                `;
            } else {
                this.elements.dayDetailContent.innerHTML = followUps.map(account => {
                    const priority = (account.Priority_Tier || 'd').toLowerCase();
                    const followUpType = account.Follow_Up_Type || 'Call';

                    return `
                        <div class="day-detail-item priority-${priority}" data-id="${account.ID_Customer}">
                            <div class="day-detail-company">${this.escapeHtml(account.CompanyName || account.Company_Name)}</div>
                            <div class="day-detail-contact">
                                <i class="fas fa-user"></i> ${this.escapeHtml(account.Main_Contact_Name || 'No contact')}
                            </div>
                            ${account.Main_Contact_Phone ? `
                                <div class="day-detail-phone">
                                    <a href="tel:${this.escapeHtml(account.Main_Contact_Phone)}">
                                        <i class="fas fa-phone"></i> ${this.escapeHtml(account.Main_Contact_Phone)}
                                    </a>
                                </div>
                            ` : ''}
                            <div class="day-detail-type">
                                <i class="fas fa-${this.getFollowUpIcon(followUpType)}"></i>
                                ${followUpType}
                            </div>
                        </div>
                    `;
                }).join('');

                // Add click handlers
                this.elements.dayDetailContent.querySelectorAll('.day-detail-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.openModal(item.dataset.id);
                    });
                });
            }
        }

        // Open side panel (legacy)
        if (this.elements.dayDetailPanel) {
            this.elements.dayDetailPanel.classList.add('open');
        }
    }

    /**
     * Close day detail panel
     */
    closeDayDetail() {
        if (this.elements.dayDetailPanel) {
            this.elements.dayDetailPanel.classList.remove('open');
        }
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
     * Open CRM modal for an account
     */
    async openModal(accountId) {
        try {
            const response = await fetch(`${this.baseURL}/api/taneisha-accounts/${accountId}`);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            const account = data.Result ? data.Result[0] : data;

            if (!account) {
                this.showError('Account not found.');
                return;
            }

            this.selectedAccount = account;

            // Populate modal
            if (this.elements.modalCompanyName) {
                this.elements.modalCompanyName.textContent = account.CompanyName || account.Company_Name;
            }

            // Update tier badge
            if (this.elements.modalTierBadge) {
                const tierInfo = this.getTierInfo(account.Account_Tier);
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
            const response = await fetch(`${this.baseURL}/api/taneisha-accounts/${accountId}/crm`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(crmData)
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            // Close modal
            this.closeModal();

            // Reload data and refresh calendar
            await this.loadAccounts();
            this.applyTierFilter();
            this.renderCalendar();
            this.renderCallThisMonth();

            // Refresh day detail if open
            if (this.selectedDate) {
                this.showDayDetail(this.selectedDate);
            }

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
    window.calendarController = new TaneishaCalendar();
    window.calendarController.init();
});
