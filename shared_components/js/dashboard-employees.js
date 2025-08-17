/**
 * Employee Data and Celebration Functions
 * Northwest Custom Apparel - Staff Dashboard
 * 
 * This module handles all employee-related data and functions including:
 * - Employee directory data
 * - Birthday and anniversary tracking
 * - Celebration widgets and notifications
 */

(function(window) {
    'use strict';
    
    // =====================================================
    // EMPLOYEE DATA
    // =====================================================
    
    const employees = [
        {
            firstName: "Jim",
            lastName: "Mickelson",
            startDate: "1977-10-31",
            birthday: "03-25",
            position: "CEO"
        },
        {
            firstName: "Erik",
            lastName: "Mickelson",
            startDate: "1996-12-16",
            birthday: "02-14",
            position: "Operations Manager"
        },
        {
            firstName: "Ruthie",
            lastName: "Nhoung",
            startDate: "1998-08-05",
            birthday: "01-19",
            position: "Production Manager"
        },
        {
            firstName: "Savy",
            lastName: "Som",
            startDate: "2008-04-21",
            birthday: "09-08",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Sorphorn",
            lastName: "Sorm",
            startDate: "2011-04-11",
            birthday: "07-10",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Nika",
            lastName: "Lao",
            startDate: "2012-07-31",
            birthday: "06-29",
            position: "Account Executive"
        },
        {
            firstName: "Taylar",
            lastName: "Hanson",
            startDate: "2015-04-20",
            birthday: "06-30",
            position: "Account Executive",
            endDate: "2025-08-29"
        },
        {
            firstName: "Bunsereytheavy",
            lastName: "Hoeu",
            startDate: "2015-05-19",
            birthday: "01-01",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Bradley",
            lastName: "Wright",
            startDate: "2017-08-10",
            birthday: "01-09",
            position: "Accounting/Purchasing/Webstores"
        },
        {
            firstName: "Steve",
            lastName: "Deland",
            startDate: "2017-09-28",
            birthday: "06-30",
            position: "Graphic Artist"
        },
        {
            firstName: "Kanha",
            lastName: "Chhorn",
            startDate: "2018-02-21",
            birthday: "06-11",
            position: "Embroidery Supervisor & Machine Operator"
        },
        {
            firstName: "Brian",
            lastName: "Beardsley",
            startDate: "2018-08-13",
            birthday: "06-29",
            position: "DTG Supervisor"
        },
        {
            firstName: "Sreynai",
            lastName: "Meang",
            startDate: "2019-12-09",
            birthday: "09-02",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Sothea",
            lastName: "Tann",
            startDate: "2022-09-22",
            birthday: "04-23",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Joseph",
            lastName: "Hallowell",
            startDate: "2023-04-03",
            birthday: "08-14",
            position: "DTG Operator"
        },
        {
            firstName: "Sothida",
            lastName: "Khiev",
            startDate: "2024-03-01",
            birthday: "06-29",
            position: "Embroidery Machine Operator"
        },
        {
            firstName: "Mikalah",
            lastName: "Hede",
            startDate: "2024-10-03",
            birthday: "04-21",
            position: "Shipping/Receiving Clerk"
        },
        {
            firstName: "Adriyella",
            lastName: "Trujillo",
            startDate: "2025-02-17",
            birthday: "02-10",
            position: "Office Assistant",
            endDate: "2025-11-15"
        },
        {
            firstName: "Taneisha",
            lastName: "Clark",
            startDate: "2025-08-12",
            position: "Sales Coordinator"
        }
    ];
    
    // =====================================================
    // DATE UTILITY FUNCTIONS
    // =====================================================
    
    /**
     * Calculate days until a specific date (birthdays/anniversaries)
     * @param {string} monthDay - MM-DD format for birthdays
     * @param {boolean} isAnniversary - Whether this is an anniversary date
     * @returns {number} Days until the date
     */
    function getDaysUntilDate(monthDay, isAnniversary = false) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let targetDate;
        
        if (isAnniversary) {
            targetDate = new Date(monthDay);
            const currentYear = today.getFullYear();
            targetDate.setFullYear(currentYear);
            
            if (targetDate < today) {
                targetDate.setFullYear(currentYear + 1);
            }
        } else {
            const [month, day] = monthDay.split('-');
            const currentYear = today.getFullYear();
            targetDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
            
            if (targetDate < today) {
                targetDate.setFullYear(currentYear + 1);
            }
        }
        
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }
    
    /**
     * Format a date for display
     * @param {string} monthDay - MM-DD format or full date string
     * @param {boolean} isAnniversary - Whether this is an anniversary date
     * @returns {string} Formatted date string
     */
    function formatCelebrationDate(monthDay, isAnniversary = false) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (isAnniversary) {
            const date = new Date(monthDay);
            return `${monthNames[date.getMonth()]} ${date.getDate()}`;
        } else {
            const [month, day] = monthDay.split('-');
            return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
        }
    }
    
    /**
     * Format a full date for display
     * @param {string} dateString - Date string to format
     * @returns {string} Formatted date string
     */
    function formatDate(dateString) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const date = new Date(dateString);
        return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
    
    /**
     * Calculate years of service for an employee
     * @param {string} startDate - Employee start date
     * @returns {number} Years of service
     */
    function calculateYearsOfService(startDate) {
        const start = new Date(startDate);
        const now = new Date();
        
        let years = now.getFullYear() - start.getFullYear();
        const monthDiff = now.getMonth() - start.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
            years--;
        }
        
        return years;
    }
    
    /**
     * Calculate detailed tenure information
     * @param {string} startDate - Employee start date
     * @returns {object} Tenure details
     */
    function calculateDetailedTenure(startDate) {
        const start = new Date(startDate);
        const now = new Date();
        
        // Check if future start date
        if (start > now) {
            const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
            return { 
                display: `Starts in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
                years: 0,
                sortValue: -daysUntil
            };
        }
        
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();
        
        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }
        
        if (months < 0) {
            years--;
            months += 12;
        }
        
        // Build display string
        const parts = [];
        if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
        if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
        if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        
        return {
            display: parts.join(', '),
            years: years,
            sortValue: years * 365 + months * 30 + days
        };
    }
    
    // =====================================================
    // EMPLOYEE STATUS FUNCTIONS
    // =====================================================
    
    /**
     * Get the current status of an employee
     * @param {object} employee - Employee object
     * @returns {object} Status information
     */
    function getEmployeeStatus(employee) {
        const today = new Date();
        const startDate = new Date(employee.startDate);
        
        if (startDate > today) {
            return { type: 'future', text: 'Starting Soon', class: 'future' };
        }
        
        if (employee.endDate) {
            const endDate = new Date(employee.endDate);
            if (endDate < today) {
                return { type: 'left', text: 'Former Employee', class: 'left' };
            } else {
                const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                return { type: 'leaving', text: `Leaving in ${daysUntil} days`, class: 'leaving' };
            }
        }
        
        return { type: 'active', text: 'Active', class: 'active' };
    }
    
    // =====================================================
    // CELEBRATION FUNCTIONS
    // =====================================================
    
    /**
     * Get upcoming celebrations (birthdays and anniversaries)
     * @param {number} daysAhead - Number of days to look ahead
     * @returns {object} Object containing birthdays and anniversaries arrays
     */
    function getUpcomingCelebrations(daysAhead = 12) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingBirthdays = [];
        const upcomingAnniversaries = [];
        
        employees.forEach(employee => {
            // Skip if employee hasn't started yet
            const startDate = new Date(employee.startDate);
            if (startDate > today) return;
            
            // Skip if employee has left
            if (employee.endDate) {
                const endDate = new Date(employee.endDate);
                if (endDate <= today) return;
            }
            
            // Check birthdays
            if (employee.birthday) {
                const daysUntil = getDaysUntilDate(employee.birthday);
                if (daysUntil >= 0 && daysUntil <= daysAhead) {
                    upcomingBirthdays.push({
                        ...employee,
                        daysUntil,
                        dateDisplay: formatCelebrationDate(employee.birthday)
                    });
                }
            }
            
            // Check work anniversaries
            const anniversaryDate = `${startDate.getMonth() + 1}`.padStart(2, '0') + '-' + 
                                  `${startDate.getDate()}`.padStart(2, '0');
            const daysUntilAnniversary = getDaysUntilDate(anniversaryDate);
            
            if (daysUntilAnniversary >= 0 && daysUntilAnniversary <= daysAhead) {
                const yearsOfService = calculateYearsOfService(employee.startDate) + 1; // Next anniversary
                upcomingAnniversaries.push({
                    ...employee,
                    daysUntil: daysUntilAnniversary,
                    dateDisplay: formatCelebrationDate(anniversaryDate),
                    yearsOfService
                });
            }
        });
        
        // Sort by days until
        upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
        upcomingAnniversaries.sort((a, b) => a.daysUntil - b.daysUntil);
        
        return { birthdays: upcomingBirthdays, anniversaries: upcomingAnniversaries };
    }
    
    /**
     * Update the celebrations widget in the UI
     */
    function updateCelebrationsWidget() {
        const celebrations = getUpcomingCelebrations(12);
        
        // Update birthday widget
        const birthdayCount = document.getElementById('birthdayCount');
        const birthdayList = document.getElementById('birthdayList');
        const birthdayWidget = document.getElementById('birthdayWidget');
        
        if (birthdayCount) {
            birthdayCount.textContent = celebrations.birthdays.length;
        }
        
        // Check if any birthdays are today
        const todayBirthdays = celebrations.birthdays.filter(b => b.daysUntil === 0);
        if (birthdayWidget) {
            if (todayBirthdays.length > 0) {
                birthdayWidget.classList.add('celebration-today');
            } else {
                birthdayWidget.classList.remove('celebration-today');
            }
        }
        
        // Build birthday list HTML
        if (birthdayList) {
            if (celebrations.birthdays.length > 0) {
                birthdayList.innerHTML = celebrations.birthdays.map(person => {
                    const isToday = person.daysUntil === 0;
                    const dayText = isToday ? 'Today!' : 
                                   person.daysUntil === 1 ? 'Tomorrow' : 
                                   `In ${person.daysUntil} days`;
                    
                    return `
                        <div class="celebration-entry ${isToday ? 'today' : ''}">
                            <span class="celebration-entry-icon">🎂</span>
                            <div class="celebration-entry-details">
                                <div class="celebration-entry-name">${person.firstName} ${person.lastName}</div>
                                <div class="celebration-entry-info">${person.dateDisplay}</div>
                            </div>
                            <div class="celebration-entry-date">${dayText}</div>
                        </div>
                    `;
                }).join('');
            } else {
                birthdayList.innerHTML = '<div class="no-celebrations">No upcoming birthdays</div>';
            }
        }
        
        // Update anniversary widget
        const anniversaryCount = document.getElementById('anniversaryCount');
        const anniversaryList = document.getElementById('anniversaryList');
        const anniversaryWidget = document.getElementById('anniversaryWidget');
        
        if (anniversaryCount) {
            anniversaryCount.textContent = celebrations.anniversaries.length;
        }
        
        // Check if any anniversaries are today
        const todayAnniversaries = celebrations.anniversaries.filter(a => a.daysUntil === 0);
        if (anniversaryWidget) {
            if (todayAnniversaries.length > 0) {
                anniversaryWidget.classList.add('celebration-today');
            } else {
                anniversaryWidget.classList.remove('celebration-today');
            }
        }
        
        // Build anniversary list HTML
        if (anniversaryList) {
            if (celebrations.anniversaries.length > 0) {
                anniversaryList.innerHTML = celebrations.anniversaries.map(person => {
                    const isToday = person.daysUntil === 0;
                    const dayText = isToday ? 'Today!' : 
                                   person.daysUntil === 1 ? 'Tomorrow' : 
                                   `In ${person.daysUntil} days`;
                    
                    return `
                        <div class="celebration-entry ${isToday ? 'today' : ''}">
                            <span class="celebration-entry-icon">🏆</span>
                            <div class="celebration-entry-details">
                                <div class="celebration-entry-name">${person.firstName} ${person.lastName}</div>
                                <div class="celebration-entry-info">${person.yearsOfService} year${person.yearsOfService !== 1 ? 's' : ''} • ${person.dateDisplay}</div>
                            </div>
                            <div class="celebration-entry-date">${dayText}</div>
                        </div>
                    `;
                }).join('');
            } else {
                anniversaryList.innerHTML = '<div class="no-celebrations">No upcoming anniversaries</div>';
            }
        }
    }
    
    /**
     * Toggle celebration dropdown visibility
     * @param {string} type - 'birthday' or 'anniversary'
     * @param {Event} event - Click event
     */
    function toggleCelebrationDropdown(type, event) {
        if (event) event.stopPropagation();
        
        const dropdown = document.getElementById(`${type}Dropdown`);
        const otherType = type === 'birthday' ? 'anniversary' : 'birthday';
        const otherDropdown = document.getElementById(`${otherType}Dropdown`);
        
        if (dropdown && otherDropdown) {
            // Close other dropdown
            otherDropdown.classList.remove('active');
            
            // Toggle current dropdown
            dropdown.classList.toggle('active');
        }
    }
    
    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Export to global namespace
    window.DashboardEmployees = {
        // Data
        employees: employees,
        
        // Date utilities
        getDaysUntilDate: getDaysUntilDate,
        formatCelebrationDate: formatCelebrationDate,
        formatDate: formatDate,
        calculateYearsOfService: calculateYearsOfService,
        calculateDetailedTenure: calculateDetailedTenure,
        
        // Employee functions
        getEmployeeStatus: getEmployeeStatus,
        getUpcomingCelebrations: getUpcomingCelebrations,
        
        // UI functions
        updateCelebrationsWidget: updateCelebrationsWidget,
        toggleCelebrationDropdown: toggleCelebrationDropdown,
        
        // Initialize
        init: function() {
            console.log('[DashboardEmployees] Initializing employee module');
            
            // Update celebrations on load
            updateCelebrationsWidget();
            
            // Setup event listeners for dropdowns
            document.addEventListener('click', function(event) {
                if (!event.target.closest('.celebration-item')) {
                    const birthdayDropdown = document.getElementById('birthdayDropdown');
                    const anniversaryDropdown = document.getElementById('anniversaryDropdown');
                    
                    if (birthdayDropdown) birthdayDropdown.classList.remove('active');
                    if (anniversaryDropdown) anniversaryDropdown.classList.remove('active');
                }
            });
            
            console.log('[DashboardEmployees] Employee module initialized');
        }
    };
    
})(window);