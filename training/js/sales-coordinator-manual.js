/* Original training roster data; local calendar dates avoid UTC day shifts. */
function localCalendarDate(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
        // Employee data for Chapter 43
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

        // Calculate detailed tenure from start date (matching staff dashboard)
        function calculateDetailedTenure(startDate) {
            const start = localCalendarDate(startDate);
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
        
        // Format tenure display
        function formatTenure(startDate) {
            const tenure = calculateDetailedTenure(startDate);
            return tenure.display;
        }

        // Format date for display
        function formatDateDisplay(dateStr) {
            const date = localCalendarDate(dateStr);
            const options = { month: 'long', day: 'numeric', year: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        }

        // Format birthday for display
        function formatBirthday(birthday) {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
            const [month, day] = birthday.split('-');
            return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
        }

        // Calculate days until a date (birthday or anniversary)
        function calculateDaysUntil(dateString, isAnniversary = false) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let targetDate;
            if (isAnniversary) {
                targetDate = localCalendarDate(dateString);
                targetDate.setFullYear(today.getFullYear());
            } else {
                const [month, day] = dateString.split('-');
                targetDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
            }
            targetDate.setHours(0, 0, 0, 0);
            
            if (targetDate < today) {
                targetDate.setFullYear(today.getFullYear() + 1);
            }
            
            const diffTime = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
        }

        // Get upcoming celebrations
        function getUpcomingCelebrations(daysAhead = 30) {
            const celebrations = [];
            const today = new Date();
            
            employees.forEach(emp => {
                // Check birthdays
                const daysUntilBirthday = emp.birthday ? calculateDaysUntil(emp.birthday) : Infinity;
                if (daysUntilBirthday <= daysAhead) {
                    celebrations.push({
                        name: emp.firstName + (emp.lastName ? ' ' + emp.lastName : ''),
                        type: 'birthday',
                        date: emp.birthday,
                        daysUntil: daysUntilBirthday,
                        displayDate: formatBirthday(emp.birthday)
                    });
                }
                
                // Check work anniversaries
                const daysUntilAnniversary = calculateDaysUntil(emp.startDate, true);
                if (daysUntilAnniversary <= daysAhead) {
                    const upcoming = new Date(today.getFullYear(), localCalendarDate(emp.startDate).getMonth(), localCalendarDate(emp.startDate).getDate());
                    if (calculateDaysUntil(emp.startDate, true) > 0 && upcoming < today) upcoming.setFullYear(upcoming.getFullYear() + 1);
                    const years = upcoming.getFullYear() - localCalendarDate(emp.startDate).getFullYear();
                    celebrations.push({
                        name: emp.firstName + (emp.lastName ? ' ' + emp.lastName : ''),
                        type: 'anniversary',
                        date: emp.startDate,
                        daysUntil: daysUntilAnniversary,
                        years: years,
                        displayDate: formatDateDisplay(emp.startDate)
                    });
                }
            });
            
            // Sort by days until
            celebrations.sort((a, b) => a.daysUntil - b.daysUntil);
            
            return celebrations;
        }

        // Populate staff roster table
        function populateStaffRoster() {
            const tbody = document.getElementById('staffRosterBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            // Sort employees by tenure (longest first)
            const sortedEmployees = [...employees].sort((a, b) => {
                return localCalendarDate(a.startDate) - localCalendarDate(b.startDate);
            });
            
            sortedEmployees.forEach(emp => {
                const row = document.createElement('tr');
                const fullName = emp.firstName + (emp.lastName ? ' ' + emp.lastName : '');
                
                // Determine status
                let status = 'Active';
                const now = new Date();
                const startDate = localCalendarDate(emp.startDate);
                
                if (startDate > now) {
                    const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
                    status = `Starting in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
                } else if (emp.endDate) {
                    const endDate = localCalendarDate(emp.endDate);
                    if (endDate > now) {
                        const daysUntil = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                        status = `Leaving in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
                    } else {
                        status = 'Departed';
                    }
                }
                
                // Format birthday - handle missing birthdays
                const birthdayDisplay = emp.birthday ? formatBirthday(emp.birthday) : '-';
                
                [fullName, emp.position, formatDateDisplay(emp.startDate), formatTenure(emp.startDate), birthdayDisplay, status].forEach(value => {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    row.append(cell);
                });

                tbody.appendChild(row);
            });
        }

        // Plain DOM rendering preserves names and avoids embedded presentation styles.
        function updateCelebrationsWidget() {
            const widget = document.getElementById('celebrationsWidget');
            if (!widget) return;
            const celebrations = getUpcomingCelebrations(30);
            widget.replaceChildren();
            if (!celebrations.length) {
                const empty = document.createElement('p');
                empty.textContent = 'No upcoming celebrations in the next 30 days.';
                widget.append(empty);
                return;
            }
            celebrations.forEach(celebration => {
                const item = document.createElement('div');
                item.className = 'celebration';
                const title = document.createElement('strong');
                const dayText = celebration.daysUntil === 0 ? 'TODAY!' : celebration.daysUntil === 1 ? 'Tomorrow' : 'In ' + celebration.daysUntil + ' days';
                title.textContent = celebration.type === 'birthday' ? '🎂 ' + celebration.name + "'s Birthday" : '🎉 ' + celebration.name + "'s " + celebration.years + '-Year Anniversary';
                const timing = document.createElement('p');
                timing.textContent = celebration.type === 'birthday' ? celebration.displayDate + ' - ' + dayText : dayText;
                item.append(title, timing);
                widget.append(item);
            });
        }
document.addEventListener('DOMContentLoaded', () => { populateStaffRoster(); updateCelebrationsWidget(); });
