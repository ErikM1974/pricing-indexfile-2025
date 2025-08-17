/**
 * Main Dashboard Initialization
 * Northwest Custom Apparel - Staff Dashboard
 * 
 * This is the main entry point that initializes all dashboard modules
 * and sets up the application state.
 */

(function(window, document) {
    'use strict';
    
    // =====================================================
    // GLOBAL STATE MANAGEMENT
    // =====================================================
    
    // Dashboard state variables
    let currentDateRange = 30;
    let currentSalesTeamRange = 30;
    let currentOrderTypesRange = 30;
    let loadingSalesTeam = false;
    let loadingOrderTypes = false;
    
    // Announcement system
    const dismissedAnnouncements = new Set(
        JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]')
    );
    
    // =====================================================
    // INITIALIZATION FUNCTIONS
    // =====================================================
    
    /**
     * Initialize all dashboard modules
     */
    function initializeDashboard() {
        console.log('[Dashboard] Starting initialization...');
        
        // Check if all required modules are loaded
        if (!window.DashboardEmployees) {
            console.error('[Dashboard] DashboardEmployees module not loaded');
            return;
        }
        
        if (!window.DashboardNavigation) {
            console.error('[Dashboard] DashboardNavigation module not loaded');
            return;
        }
        
        if (!window.DashboardUtilities) {
            console.error('[Dashboard] DashboardUtilities module not loaded');
            return;
        }
        
        // Initialize modules
        try {
            // Initialize employee module
            window.DashboardEmployees.init();
            
            // Initialize navigation module
            window.DashboardNavigation.init();
            
            // Initialize utilities module
            window.DashboardUtilities.init();
            
            // Setup additional event handlers
            setupEventHandlers();
            
            // Load initial data
            loadInitialData();
            
            // Setup auto-refresh
            setupAutoRefresh();
            
            console.log('[Dashboard] Initialization complete');
            
        } catch (error) {
            console.error('[Dashboard] Initialization error:', error);
        }
    }
    
    /**
     * Setup global event handlers
     */
    function setupEventHandlers() {
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobileMenuToggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', function() {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('active');
                }
            });
        }
        
        // Date range selectors
        document.querySelectorAll('.date-range-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const days = parseInt(this.getAttribute('data-days'));
                const selector = this.closest('.date-range-selector');
                
                // Update active state
                selector.querySelectorAll('.date-range-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Call appropriate function based on context
                if (selector.classList.contains('sales-team-date-selector')) {
                    changeSalesTeamRange(days);
                } else if (selector.classList.contains('order-types-date-selector')) {
                    changeOrderTypesRange(days);
                } else {
                    changeDateRange(days);
                }
            });
        });
        
        // Search functionality
        const searchInput = document.getElementById('dashboardSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }
    }
    
    /**
     * Load initial dashboard data
     */
    async function loadInitialData() {
        console.log('[Dashboard] Loading initial data...');
        
        try {
            // Load revenue data
            const revenueData = await window.DashboardUtilities.loadRevenueData(currentDateRange);
            updateRevenueDisplay(revenueData);
            
            // Load production schedule
            const schedule = await window.DashboardUtilities.loadProductionSchedule();
            window.DashboardUtilities.updateProductionDisplay(schedule);
            
            // Load year-over-year comparison
            const yoyData = await window.DashboardUtilities.loadYearOverYear();
            updateYearOverYearDisplay(yoyData);
            
            // Load sales team performance
            const salesData = await window.DashboardUtilities.loadSalesTeamPerformance(currentSalesTeamRange);
            updateSalesTeamDisplay(salesData);
            
            // Load order types breakdown
            const orderData = await window.DashboardUtilities.loadOrderTypesBreakdown(currentOrderTypesRange);
            updateOrderTypesDisplay(orderData);
            
            // Load announcements
            loadAnnouncements();
            
        } catch (error) {
            console.error('[Dashboard] Error loading initial data:', error);
        }
    }
    
    /**
     * Setup auto-refresh for dashboard data
     */
    function setupAutoRefresh() {
        // Refresh revenue data every 5 minutes
        setInterval(() => {
            window.DashboardUtilities.loadRevenueData(currentDateRange)
                .then(updateRevenueDisplay)
                .catch(console.error);
        }, 5 * 60 * 1000);
        
        // Refresh production schedule every 10 minutes
        setInterval(() => {
            window.DashboardUtilities.loadProductionSchedule()
                .then(window.DashboardUtilities.updateProductionDisplay)
                .catch(console.error);
        }, 10 * 60 * 1000);
        
        // Refresh weather every 30 minutes
        setInterval(() => {
            window.DashboardUtilities.loadWeatherData();
        }, 30 * 60 * 1000);
        
        // Update celebrations at midnight
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            window.DashboardEmployees.updateCelebrationsWidget();
            // Then update every 24 hours
            setInterval(() => {
                window.DashboardEmployees.updateCelebrationsWidget();
            }, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
    }
    
    // =====================================================
    // DATE RANGE FUNCTIONS
    // =====================================================
    
    /**
     * Change the main date range
     * @param {number} days - Number of days
     */
    function changeDateRange(days) {
        currentDateRange = days;
        console.log(`[Dashboard] Date range changed to ${days} days`);
        
        // Reload revenue data
        window.DashboardUtilities.loadRevenueData(days)
            .then(updateRevenueDisplay)
            .catch(console.error);
    }
    
    /**
     * Change sales team date range
     * @param {number} days - Number of days
     */
    function changeSalesTeamRange(days) {
        currentSalesTeamRange = days;
        console.log(`[Dashboard] Sales team range changed to ${days} days`);
        
        // Reload sales team data
        window.DashboardUtilities.loadSalesTeamPerformance(days)
            .then(updateSalesTeamDisplay)
            .catch(console.error);
    }
    
    /**
     * Change order types date range
     * @param {number} days - Number of days
     */
    function changeOrderTypesRange(days) {
        currentOrderTypesRange = days;
        console.log(`[Dashboard] Order types range changed to ${days} days`);
        
        // Reload order types data
        window.DashboardUtilities.loadOrderTypesBreakdown(days)
            .then(updateOrderTypesDisplay)
            .catch(console.error);
    }
    
    // =====================================================
    // DISPLAY UPDATE FUNCTIONS
    // =====================================================
    
    /**
     * Update revenue display
     * @param {Object} data - Revenue data
     */
    function updateRevenueDisplay(data) {
        const totalRevenue = document.getElementById('totalRevenue');
        const revenueChange = document.getElementById('revenueChange');
        
        if (totalRevenue && data.totalRevenue) {
            totalRevenue.textContent = `$${data.totalRevenue.toLocaleString()}`;
        }
        
        if (revenueChange && data.revenueChange !== undefined) {
            const isPositive = data.revenueChange >= 0;
            revenueChange.innerHTML = `${isPositive ? '↑' : '↓'} ${Math.abs(data.revenueChange).toFixed(1)}%`;
            revenueChange.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    /**
     * Update year-over-year display
     * @param {Object} data - YoY data
     */
    function updateYearOverYearDisplay(data) {
        if (!data) return;
        
        const lastYearTotal = document.getElementById('lastYearTotal');
        const thisYearTotal = document.getElementById('thisYearTotal');
        const yoyGrowth = document.getElementById('yoyGrowth');
        
        if (lastYearTotal) {
            lastYearTotal.textContent = `$${data.lastYearTotal.toLocaleString()}`;
        }
        
        if (thisYearTotal) {
            thisYearTotal.textContent = `$${data.currentYearTotal.toLocaleString()}`;
        }
        
        if (yoyGrowth) {
            const growth = data.salesGrowthPercent;
            const isPositive = growth >= 0;
            yoyGrowth.innerHTML = `${isPositive ? '↑' : '↓'} ${Math.abs(growth).toFixed(1)}%`;
            yoyGrowth.style.color = isPositive ? 'var(--success)' : 'var(--danger)';
        }
    }
    
    /**
     * Update sales team display
     * @param {Object} data - Sales team data
     */
    function updateSalesTeamDisplay(data) {
        // Implementation would update the sales team performance display
        console.log('[Dashboard] Updating sales team display', data);
    }
    
    /**
     * Update order types display
     * @param {Object} data - Order types data
     */
    function updateOrderTypesDisplay(data) {
        // Implementation would update the order types breakdown display
        console.log('[Dashboard] Updating order types display', data);
    }
    
    // =====================================================
    // ANNOUNCEMENTS SYSTEM
    // =====================================================
    
    /**
     * Load and display announcements
     */
    function loadAnnouncements() {
        // This would typically load from an API or data source
        // For now, using static announcements
        const announcements = getStaticAnnouncements();
        displayAnnouncements(announcements);
    }
    
    /**
     * Get static announcements (placeholder)
     */
    function getStaticAnnouncements() {
        return [
            {
                id: 'ann-001',
                type: 'info',
                title: 'Dashboard Updated',
                content: 'The staff dashboard has been modularized for better performance.',
                date: new Date().toISOString(),
                priority: 1
            }
        ];
    }
    
    /**
     * Display announcements
     * @param {Array} announcements - Array of announcement objects
     */
    function displayAnnouncements(announcements) {
        const container = document.getElementById('announcementsContainer');
        if (!container) return;
        
        const showDismissed = document.getElementById('showDismissedCheckbox')?.checked || false;
        
        const filteredAnnouncements = announcements.filter(ann => 
            showDismissed || !dismissedAnnouncements.has(ann.id)
        );
        
        if (filteredAnnouncements.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No announcements</p>';
            return;
        }
        
        container.innerHTML = filteredAnnouncements.map(ann => createAnnouncementHTML(ann)).join('');
    }
    
    /**
     * Create HTML for an announcement
     * @param {Object} announcement - Announcement object
     * @returns {string} HTML string
     */
    function createAnnouncementHTML(announcement) {
        const isDismissed = dismissedAnnouncements.has(announcement.id);
        const typeIcon = {
            urgent: '🚨',
            important: '⚠️',
            info: 'ℹ️'
        }[announcement.type] || 'ℹ️';
        
        return `
            <div class="announcement-card ${isDismissed ? 'dismissed' : 'unread'}" 
                 data-id="${announcement.id}" 
                 data-type="${announcement.type}">
                <div class="announcement-card-header" onclick="toggleAnnouncementCard('${announcement.id}')">
                    <span class="announcement-card-icon">${typeIcon}</span>
                    <div>
                        <div class="announcement-card-title">${announcement.title}</div>
                        <div class="announcement-card-meta">
                            ${new Date(announcement.date).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="announcement-card-actions">
                        <button class="announcement-card-expand" title="Toggle">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        ${!isDismissed ? `
                            <button class="dismiss-btn" onclick="dismissAnnouncement('${announcement.id}')" title="Dismiss">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="announcement-card-content">
                    ${announcement.content}
                </div>
            </div>
        `;
    }
    
    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================
    
    /**
     * Debounce function for search
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Handle search input
     * @param {Event} event - Input event
     */
    function handleSearch(event) {
        const query = event.target.value.toLowerCase();
        console.log('[Dashboard] Searching for:', query);
        // Implement search functionality
    }
    
    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Export functions to global scope for inline event handlers
    window.toggleAnnouncementCard = function(id) {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('expanded');
        }
    };
    
    window.dismissAnnouncement = function(id) {
        dismissedAnnouncements.add(id);
        localStorage.setItem('dismissedAnnouncements', JSON.stringify([...dismissedAnnouncements]));
        loadAnnouncements();
    };
    
    window.changeDateRange = changeDateRange;
    window.changeSalesTeamRange = changeSalesTeamRange;
    window.changeOrderTypesRange = changeOrderTypesRange;
    
    // =====================================================
    // INITIALIZATION
    // =====================================================
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        // DOM is already loaded
        initializeDashboard();
    }
    
})(window, document);