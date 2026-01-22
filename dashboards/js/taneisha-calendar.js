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
        this.followUpsByDate = {};
        this.currentDate = new Date();
        this.selectedDate = null;

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
            this.renderCalendar();
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
                        ${this.escapeHtml(account.Company_Name)}
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
     * Show day detail panel
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
                        <div class="day-detail-item priority-${priority}" data-id="${account.PK_ID}">
                            <div class="day-detail-company">${this.escapeHtml(account.Company_Name)}</div>
                            <div class="day-detail-contact">
                                <i class="fas fa-user"></i> ${this.escapeHtml(account.Contact_Name || 'No contact')}
                            </div>
                            ${account.Contact_Phone ? `
                                <div class="day-detail-phone">
                                    <a href="tel:${this.escapeHtml(account.Contact_Phone)}">
                                        <i class="fas fa-phone"></i> ${this.escapeHtml(account.Contact_Phone)}
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

        // Open panel
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
                this.elements.modalCompanyName.textContent = account.Company_Name;
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
            this.renderCalendar();

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
