/* sales-coordinator-manual.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in training/sales-coordinator-manual.html (Rule 3, 2026.09.05.7) ──
// Show specific chapter
        function showChapter(chapterId) {
            console.log(`Navigating to chapter: ${chapterId}`);
            
            // Hide all chapters
            document.querySelectorAll('.chapter').forEach(chapter => {
                chapter.classList.remove('active');
            });
            
            // Show selected chapter
            const chapter = document.getElementById(chapterId);
            if (chapter) {
                chapter.classList.add('active');
                console.log(`Successfully activated chapter: ${chapterId}`);
                
                // If it's Chapter 43, populate the staff data
                if (chapterId === 'chapter43') {
                    populateStaffRoster();
                    updateCelebrationsWidget();
                }
                
                // Update sidebar navigation to show active chapter
                updateSidebarActiveState(chapterId);
                
                // Scroll the content container to top to show the new chapter
                const contentContainer = document.querySelector('.content');
                if (contentContainer) {
                    contentContainer.scrollTop = 0;
                    console.log(`Content container scrolled to top for chapter: ${chapterId}`);
                }
                
                // Also scroll the window to top in case user scrolled down
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                
                // Force the chapter into view with a small delay to ensure DOM updates
                setTimeout(() => {
                    chapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    console.log(`Chapter ${chapterId} scrolled into view`);
                }, 100);
                
            } else {
                console.error(`Chapter not found: ${chapterId}`);
                alert(`Chapter "${chapterId}" not found. Please check the navigation.`);
            }
        }
        
        // Update active state in sidebar navigation
        function updateSidebarActiveState(chapterId) {
            // Remove all active states
            document.querySelectorAll('.sidebar a').forEach(link => {
                link.classList.remove('active-chapter');
            });
            
            // Find and highlight the active chapter link
            const activeLink = document.querySelector(`.sidebar a[onclick*="'${chapterId}'"]`);
            if (activeLink) {
                activeLink.classList.add('active-chapter');
                console.log(`Highlighted sidebar link for: ${chapterId}`);
            }
        }

        // Scroll to top functionality
        window.addEventListener('scroll', function() {
            const scrollButton = document.querySelector('.scroll-to-top');
            if (window.pageYOffset > 300) {
                scrollButton.classList.add('visible');
            } else {
                scrollButton.classList.remove('visible');
            }
        });

        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

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
        
        // Calculate simple tenure years for celebrations
        function calculateTenure(startDate) {
            const start = new Date(startDate);
            const now = new Date();
            
            // If future date, return 0
            if (start > now) return 0;
            
            let years = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            
            // Check if we haven't reached the anniversary date yet this year
            if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
                years--;
            }
            
            return years;
        }

        // Format tenure display
        function formatTenure(startDate) {
            const tenure = calculateDetailedTenure(startDate);
            return tenure.display;
        }

        // Format date for display
        function formatDateDisplay(dateStr) {
            const date = new Date(dateStr);
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
                targetDate = new Date(dateString);
                targetDate.setFullYear(today.getFullYear());
            } else {
                const [month, day] = dateString.split('-');
                targetDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
            }
            targetDate.setHours(0, 0, 0, 0);
            
            if (targetDate < today) {
                targetDate.setFullYear(today.getFullYear() + 1);
            }
            
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
        }

        // Get upcoming celebrations
        function getUpcomingCelebrations(daysAhead = 30) {
            const celebrations = [];
            const today = new Date();
            
            employees.forEach(emp => {
                // Check birthdays
                const daysUntilBirthday = calculateDaysUntil(emp.birthday);
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
                    const years = calculateTenure(emp.startDate);
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
                return new Date(a.startDate) - new Date(b.startDate);
            });
            
            sortedEmployees.forEach(emp => {
                const row = document.createElement('tr');
                const fullName = emp.firstName + (emp.lastName ? ' ' + emp.lastName : '');
                
                // Determine status
                let status = 'Active';
                const now = new Date();
                const startDate = new Date(emp.startDate);
                
                if (startDate > now) {
                    const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
                    status = `Starting in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
                } else if (emp.endDate) {
                    const endDate = new Date(emp.endDate);
                    if (endDate > now) {
                        const daysUntil = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                        status = `Leaving in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
                    } else {
                        status = 'Departed';
                    }
                }
                
                // Format birthday - handle missing birthdays
                const birthdayDisplay = emp.birthday ? formatBirthday(emp.birthday) : '-';
                
                row.innerHTML = `
                    <td><strong>${fullName}</strong></td>
                    <td>${emp.position}</td>
                    <td>${formatDateDisplay(emp.startDate)}</td>
                    <td>${formatTenure(emp.startDate)}</td>
                    <td>${birthdayDisplay}</td>
                    <td>${status}</td>
                `;
                
                tbody.appendChild(row);
            });
        }

        // Update celebrations widget
        function updateCelebrationsWidget() {
            const widget = document.getElementById('celebrationsWidget');
            if (!widget) return;
            
            const celebrations = getUpcomingCelebrations(30);
            
            if (celebrations.length === 0) {
                widget.innerHTML = '<p style="color: white;">No upcoming celebrations in the next 30 days.</p>';
                return;
            }
            
            let html = '<div style="color: white;">';
            celebrations.forEach(celebration => {
                const icon = celebration.type === 'birthday' ? '🎂' : '🎉';
                let dayText = '';
                
                if (celebration.daysUntil === 0) {
                    dayText = '<strong>TODAY!</strong>';
                } else if (celebration.daysUntil === 1) {
                    dayText = 'Tomorrow';
                } else {
                    dayText = `In ${celebration.daysUntil} days`;
                }
                
                if (celebration.type === 'birthday') {
                    html += `
                        <div style="margin: 0.75rem 0; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            ${icon} <strong>${celebration.name}'s Birthday</strong><br>
                            ${celebration.displayDate} - ${dayText}
                        </div>
                    `;
                } else {
                    html += `
                        <div style="margin: 0.75rem 0; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            ${icon} <strong>${celebration.name}'s ${celebration.years}-Year Anniversary</strong><br>
                            ${dayText}
                        </div>
                    `;
                }
            });
            html += '</div>';
            
            widget.innerHTML = html;
        }

        // Initialize with foreword
        document.addEventListener('DOMContentLoaded', function() {
            showChapter('foreword');
            console.log('Sales Coordinator Manual loaded. All 43 chapters ready for navigation.');
            
            // Add click tracking for debugging
            document.querySelectorAll('.sidebar a[onclick*="showChapter"]').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const chapterMatch = this.getAttribute('onclick').match(/'([^']+)'/);
                    if (chapterMatch) {
                        console.log(`Sidebar click detected for: ${chapterMatch[1]}`);
                    }
                });
            });
        });

// ── 2026-09-05: chapter navigation via data attributes (the 45 onclick= attributes are gone) ──
document.addEventListener('click', function (e) {
    var chapter = e.target.closest('[data-chapter]');
    if (chapter) {
        e.preventDefault();
        if (typeof showChapter === 'function') showChapter(chapter.getAttribute('data-chapter'), e);
        return;
    }
    var top = e.target.closest('[data-action="scroll-top"]');
    if (top) {
        e.preventDefault();
        if (typeof scrollToTop === 'function') scrollToTop();
    }
});
