/* =====================================================
   STAFF DASHBOARD EMPLOYEES MODULE
   Employee data and celebration calculations
   ===================================================== */

const StaffDashboardEmployees = (function() {
    'use strict';

    // Employee data - birthdays are MM-DD format
    const employees = [
        { firstName: "Jim", lastName: "Mickelson", startDate: "1977-10-31", birthday: "03-25", position: "CEO" },
        { firstName: "Erik", lastName: "Mickelson", startDate: "1996-12-16", birthday: "02-14", position: "Operations Manager" },
        { firstName: "Ruthie", lastName: "Nhoung", startDate: "1998-08-05", birthday: "01-19", position: "Production Manager" },
        { firstName: "Savy", lastName: "Som", startDate: "2008-04-21", birthday: "09-08", position: "Embroidery Machine Operator" },
        { firstName: "Sorphorn", lastName: "Sorm", startDate: "2011-04-11", birthday: "07-10", position: "Embroidery Machine Operator" },
        { firstName: "Nika", lastName: "Lao", startDate: "2012-07-31", birthday: "06-29", position: "Account Executive" },
        { firstName: "Taylar", lastName: "Hanson", startDate: "2015-04-20", birthday: "06-30", position: "Account Executive", endDate: "2025-08-29" },
        { firstName: "Bunsereytheavy", lastName: "Hoeu", startDate: "2015-05-19", birthday: "01-01", position: "Embroidery Machine Operator" },
        { firstName: "Bradley", lastName: "Wright", startDate: "2017-08-10", birthday: "01-09", position: "Accounting/Purchasing/Webstores" },
        { firstName: "Steve", lastName: "Deland", startDate: "2017-09-28", birthday: "06-30", position: "Graphic Artist" },
        { firstName: "Kanha", lastName: "Chhorn", startDate: "2018-02-21", birthday: "06-11", position: "Embroidery Supervisor & Machine Operator" },
        { firstName: "Brian", lastName: "Beardsley", startDate: "2018-08-13", birthday: "06-29", position: "DTG Supervisor" },
        { firstName: "Sreynai", lastName: "Meang", startDate: "2019-12-09", birthday: "09-02", position: "Embroidery Machine Operator" },
        { firstName: "Sothea", lastName: "Tann", startDate: "2022-09-22", birthday: "04-23", position: "Embroidery Machine Operator" },
        { firstName: "Joseph", lastName: "Hallowell", startDate: "2023-04-03", birthday: "08-14", position: "DTG Operator" },
        { firstName: "Sothida", lastName: "Khiev", startDate: "2024-03-01", birthday: "06-29", position: "Embroidery Machine Operator" },
        { firstName: "Mikalah", lastName: "Hede", startDate: "2024-10-03", birthday: "04-21", position: "Shipping/Receiving Clerk" },
        { firstName: "Adriyella", lastName: "Trujillo", startDate: "2025-02-17", birthday: "02-10", position: "Office Assistant", endDate: "2025-11-15" },
        { firstName: "Taneisha", lastName: "Clark", startDate: "2025-08-12", birthday: "12-25", position: "Sales Coordinator" }
    ];

    // =====================================================
    // DATE UTILITY FUNCTIONS
    // =====================================================

    /**
     * Calculate days until a date (birthday or anniversary)
     * @param {string} monthDay - MM-DD format for birthdays, or full date for anniversaries
     * @param {boolean} isAnniversary - If true, uses full date format
     * @returns {number} Days until the date (0 = today, negative = past)
     */
    function getDaysUntilDate(monthDay, isAnniversary = false) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let targetDate;
        if (isAnniversary) {
            // For anniversaries, use the month/day from the start date in current year
            const originalDate = new Date(monthDay);
            targetDate = new Date(today.getFullYear(), originalDate.getMonth(), originalDate.getDate());
        } else {
            // For birthdays, parse MM-DD format
            const [month, day] = monthDay.split('-').map(Number);
            targetDate = new Date(today.getFullYear(), month - 1, day);
        }

        // If the date has passed this year, use next year
        if (targetDate < today) {
            targetDate.setFullYear(targetDate.getFullYear() + 1);
        }

        const diffTime = targetDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Format a date for display
     * @param {string} monthDay - MM-DD format
     * @param {boolean} isAnniversary - If true, uses full date
     * @returns {string} Formatted date string
     */
    function formatCelebrationDate(monthDay, isAnniversary = false) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        if (isAnniversary) {
            const date = new Date(monthDay);
            return `${monthNames[date.getMonth()]} ${date.getDate()}`;
        }

        const [month, day] = monthDay.split('-').map(Number);
        return `${monthNames[month - 1]} ${day}`;
    }

    /**
     * Calculate years of service
     * @param {string} startDate - YYYY-MM-DD format
     * @returns {number} Years of service
     */
    function calculateYearsOfService(startDate) {
        const start = new Date(startDate);
        const today = new Date();
        let years = today.getFullYear() - start.getFullYear();
        const monthDiff = today.getMonth() - start.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < start.getDate())) {
            years--;
        }
        return years;
    }

    /**
     * Get employee status (active, former, leaving)
     * @param {Object} employee - Employee object
     * @returns {Object} Status with type and label
     */
    function getEmployeeStatus(employee) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (employee.endDate) {
            const endDate = new Date(employee.endDate);
            if (endDate < today) {
                return { type: 'former', label: 'Former Employee' };
            } else {
                const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 14) {
                    return { type: 'leaving', label: `Leaving in ${daysUntil} days` };
                }
            }
        }
        return { type: 'active', label: 'Active' };
    }

    // =====================================================
    // EMPLOYEE QUERY FUNCTIONS
    // =====================================================

    /**
     * Get active employees (no end date or end date in future)
     * @returns {Array} Active employees
     */
    function getActiveEmployees() {
        const today = new Date();
        return employees.filter(emp => {
            if (!emp.endDate) return true;
            return new Date(emp.endDate) >= today;
        });
    }

    /**
     * Get upcoming birthdays within N days
     * @param {number} days - Number of days to look ahead
     * @returns {Array} Employees with upcoming birthdays, sorted by days until
     */
    function getUpcomingBirthdays(days = 30) {
        const activeEmps = getActiveEmployees();
        return activeEmps
            .filter(emp => emp.birthday)
            .map(emp => ({
                ...emp,
                daysUntil: getDaysUntilDate(emp.birthday, false),
                formattedDate: formatCelebrationDate(emp.birthday, false)
            }))
            .filter(emp => emp.daysUntil >= 0 && emp.daysUntil <= days)
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }

    /**
     * Get upcoming work anniversaries within N days
     * @param {number} days - Number of days to look ahead
     * @returns {Array} Employees with upcoming anniversaries, sorted by days until
     */
    function getUpcomingAnniversaries(days = 30) {
        const activeEmps = getActiveEmployees();
        return activeEmps
            .filter(emp => emp.startDate)
            .map(emp => ({
                ...emp,
                daysUntil: getDaysUntilDate(emp.startDate, true),
                yearsOfService: calculateYearsOfService(emp.startDate) + 1, // Next anniversary
                formattedDate: formatCelebrationDate(emp.startDate, true)
            }))
            .filter(emp => emp.daysUntil >= 0 && emp.daysUntil <= days)
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }

    /**
     * Get all employees with full info for staff directory
     * @returns {Array} All employees with calculated fields
     */
    function getAllEmployeesForDirectory() {
        return employees.map(emp => ({
            ...emp,
            fullName: `${emp.firstName} ${emp.lastName}`,
            yearsOfService: calculateYearsOfService(emp.startDate),
            status: getEmployeeStatus(emp),
            formattedBirthday: emp.birthday ? formatCelebrationDate(emp.birthday, false) : '',
            formattedStartDate: formatCelebrationDate(emp.startDate, true)
        }));
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    /**
     * Initialize celebrations widgets in the header
     */
    function initCelebrations() {
        updateCelebrationCounts();
    }

    /**
     * Update the birthday and anniversary counts in the header
     */
    function updateCelebrationCounts() {
        const birthdays = getUpcomingBirthdays(30);
        const anniversaries = getUpcomingAnniversaries(30);

        const birthdayCountEl = document.getElementById('birthdayCount');
        const anniversaryCountEl = document.getElementById('anniversaryCount');

        if (birthdayCountEl) {
            birthdayCountEl.textContent = birthdays.length;
        }
        if (anniversaryCountEl) {
            anniversaryCountEl.textContent = anniversaries.length;
        }
    }

    /**
     * Render birthday dropdown list
     * @param {string} containerId - ID of the container element
     */
    function renderBirthdayList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const birthdays = getUpcomingBirthdays(30);

        if (birthdays.length === 0) {
            container.innerHTML = '<div class="celebration-empty">No upcoming birthdays in the next 30 days</div>';
            return;
        }

        container.innerHTML = birthdays.map(emp => {
            const dayLabel = emp.daysUntil === 0 ? 'Today!' :
                emp.daysUntil === 1 ? 'Tomorrow' :
                    `in ${emp.daysUntil} days`;
            return `
                <div class="celebration-entry${emp.daysUntil === 0 ? ' today' : ''}">
                    <div class="celebration-name">${emp.firstName} ${emp.lastName}</div>
                    <div class="celebration-date">${emp.formattedDate} (${dayLabel})</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render anniversary dropdown list
     * @param {string} containerId - ID of the container element
     */
    function renderAnniversaryList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const anniversaries = getUpcomingAnniversaries(30);

        if (anniversaries.length === 0) {
            container.innerHTML = '<div class="celebration-empty">No upcoming anniversaries in the next 30 days</div>';
            return;
        }

        container.innerHTML = anniversaries.map(emp => {
            const dayLabel = emp.daysUntil === 0 ? 'Today!' :
                emp.daysUntil === 1 ? 'Tomorrow' :
                    `in ${emp.daysUntil} days`;
            return `
                <div class="celebration-entry${emp.daysUntil === 0 ? ' today' : ''}">
                    <div class="celebration-name">${emp.firstName} ${emp.lastName}</div>
                    <div class="celebration-date">${emp.yearsOfService} years - ${emp.formattedDate} (${dayLabel})</div>
                </div>
            `;
        }).join('');
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        // Data
        employees,

        // Query functions
        getActiveEmployees,
        getUpcomingBirthdays,
        getUpcomingAnniversaries,
        getAllEmployeesForDirectory,

        // Utility functions
        getDaysUntilDate,
        formatCelebrationDate,
        calculateYearsOfService,
        getEmployeeStatus,

        // UI functions
        initCelebrations,
        updateCelebrationCounts,
        renderBirthdayList,
        renderAnniversaryList
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.StaffDashboardEmployees = StaffDashboardEmployees;
}
