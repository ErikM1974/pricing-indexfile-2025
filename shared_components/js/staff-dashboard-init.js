/* =====================================================
   STAFF DASHBOARD INITIALIZATION
   Main entry point for dashboard functionality
   ===================================================== */

const StaffDashboardInit = (function() {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultDateRange: 30, // Default to 30 days
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        animationDuration: 300
    };

    // State
    let currentDateRange = CONFIG.defaultDateRange;
    let refreshTimer = null;

    // =====================================================
    // INITIALIZATION
    // =====================================================

    /**
     * Initialize the dashboard
     */
    async function init() {
        console.log('Initializing Staff Dashboard...');

        // Initialize widgets
        initWidgetToggles();
        initDateRangeSelector();
        initDropdowns();

        // Load announcements (if data exists)
        loadAnnouncements();

        // Load YTD for sales goal banner
        loadYTDForSalesGoal();

        // Load metrics from ShopWorks
        await loadMetrics();

        // Set up auto-refresh
        startAutoRefresh();

        console.log('Staff Dashboard initialized');
    }

    // =====================================================
    // WIDGET TOGGLES
    // =====================================================

    /**
     * Initialize collapsible widget toggles
     */
    function initWidgetToggles() {
        const widgets = document.querySelectorAll('.widget-collapsible');
        widgets.forEach(widget => {
            const header = widget.querySelector('.widget-header');
            if (header) {
                header.addEventListener('click', () => toggleWidget(widget));
            }
        });

        // Load saved collapse states
        loadWidgetStates();
    }

    /**
     * Toggle a widget's collapsed state
     */
    function toggleWidget(widget) {
        if (typeof widget === 'string') {
            widget = document.querySelector(`[data-widget="${widget}"]`);
        }
        if (!widget) return;

        widget.classList.toggle('collapsed');
        saveWidgetStates();
    }

    /**
     * Save widget collapse states to localStorage
     */
    function saveWidgetStates() {
        const states = {};
        document.querySelectorAll('.widget-collapsible').forEach(widget => {
            const id = widget.dataset.widget;
            if (id) {
                states[id] = widget.classList.contains('collapsed');
            }
        });
        localStorage.setItem('staffDashboard_widgetStates', JSON.stringify(states));
    }

    /**
     * Load widget collapse states from localStorage
     */
    function loadWidgetStates() {
        try {
            const stored = localStorage.getItem('staffDashboard_widgetStates');
            if (stored) {
                const states = JSON.parse(stored);
                Object.entries(states).forEach(([id, collapsed]) => {
                    const widget = document.querySelector(`[data-widget="${id}"]`);
                    if (widget) {
                        widget.classList.toggle('collapsed', collapsed);
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load widget states:', e);
        }
    }

    // =====================================================
    // DATE RANGE SELECTOR
    // =====================================================

    /**
     * Initialize date range selector buttons
     */
    function initDateRangeSelector() {
        const buttons = document.querySelectorAll('.date-range-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.days) || 30;
                setDateRange(days);
            });
        });
    }

    /**
     * Set the active date range and reload metrics
     */
    async function setDateRange(days) {
        currentDateRange = days;

        // Update button states
        document.querySelectorAll('.date-range-btn').forEach(btn => {
            const btnDays = parseInt(btn.dataset.days) || 30;
            btn.classList.toggle('active', btnDays === days);
        });

        // Reload metrics
        await loadMetrics(true);
    }

    // =====================================================
    // DROPDOWNS
    // =====================================================

    /**
     * Initialize dropdown menus
     */
    function initDropdowns() {
        const dropdowns = document.querySelectorAll('.tool-dropdown');
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.tool-dropdown-btn');
            const menu = dropdown.querySelector('.tool-dropdown-menu');

            if (btn && menu) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('open');
                });
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.tool-dropdown-menu.open').forEach(menu => {
                menu.classList.remove('open');
            });
        });
    }

    // =====================================================
    // ANNOUNCEMENTS
    // =====================================================

    /**
     * Load announcements data
     */
    function loadAnnouncements() {
        // Check if announcements data exists (may be embedded in page or fetched)
        if (typeof staffAnnouncementsData !== 'undefined' && StaffDashboardAnnouncements) {
            StaffDashboardAnnouncements.setAnnouncements(staffAnnouncementsData);
            StaffDashboardAnnouncements.renderAnnouncementHero('announcementsHero');
            StaffDashboardAnnouncements.renderAnnouncementsList('announcementsList');
        }
    }

    // =====================================================
    // METRICS LOADING
    // =====================================================

    /**
     * Load metrics from ShopWorks API
     * Revenue uses selected date range (7/30/60D)
     * Team Performance uses YTD (Jan 1 - today) separately
     */
    async function loadMetrics(forceRefresh = false) {
        if (!StaffDashboardService) {
            console.warn('StaffDashboardService not available');
            return;
        }

        // Show loading state
        showMetricsLoading();

        try {
            // Load revenue metrics with selected date range (7/30/60D)
            const metrics = await StaffDashboardService.getMetrics(currentDateRange, forceRefresh);

            // Load team performance with hybrid approach (archived + live data)
            // Uses Caspio archive for older data + ManageOrders for recent days
            const teamDataYTD = await loadTeamPerformanceYTDHybrid();

            // Render revenue (uses metrics.yoy for the selected period)
            renderRevenueCard(metrics.yoy, metrics.revenue, metrics.period);

            // Render team with YTD data (no YoY comparison)
            renderTeamPerformanceYTD(teamDataYTD);

            // Update data source badge
            updateDataSourceBadge(metrics.hasPartialData);

            if (metrics.hasPartialData) {
                showPartialDataWarning();
            }

            updateLastRefreshTime();
        } catch (error) {
            console.error('Failed to load metrics:', error);
            showMetricsError(error.message);
        }
    }

    /**
     * Show loading state for metrics
     */
    function showMetricsLoading() {
        const revenueValue = document.getElementById('ytdRevenue');
        const teamList = document.getElementById('salesTeamList');

        if (revenueValue) {
            revenueValue.innerHTML = '<span class="skeleton skeleton-value"></span>';
        }

        if (teamList) {
            teamList.innerHTML = `
                <div class="metrics-loading">
                    <div class="loading"></div>
                    <span>Loading from ShopWorks...</span>
                </div>
            `;
        }
    }

    /**
     * Show error state for metrics
     */
    function showMetricsError(message) {
        const teamList = document.getElementById('salesTeamList');
        if (teamList) {
            teamList.innerHTML = `
                <div class="error-state">
                    <div class="error-state-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="error-state-content">
                        <div class="error-state-title">Unable to load metrics</div>
                        <div class="error-state-message">${message || 'Please try again later.'}</div>
                        <button class="error-state-retry" onclick="StaffDashboardInit.loadMetrics(true)">
                            Try again
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render metrics data
     */
    function renderMetrics(metrics) {
        if (!metrics) return;

        // Render Revenue with date details (handles null gracefully)
        renderRevenueCard(metrics.yoy, metrics.revenue, metrics.period);

        // Render Team Performance (handles null gracefully)
        renderTeamPerformance(metrics.team);

        // Update data source badge
        updateDataSourceBadge(metrics.hasPartialData);

        // Show warning if we have partial data
        if (metrics.hasPartialData) {
            showPartialDataWarning();
        }
    }

    /**
     * Show warning when only partial data is available
     */
    function showPartialDataWarning() {
        const container = document.getElementById('partialDataWarning');
        if (container) {
            container.innerHTML = `
                <div class="partial-data-notice">
                    <i class="fas fa-info-circle"></i>
                    <span>Some metrics could not be loaded. Showing available data.</span>
                </div>
            `;
            container.style.display = 'block';
        }
    }

    /**
     * Get period label for display
     */
    function getPeriodLabel(days) {
        if (days === 7) return 'Last 7 Days';
        if (days === 30) return 'Last 30 Days';
        if (days === 60) return 'Last 60 Days';
        return `Last ${days} Days`;
    }

    /**
     * Render the revenue card
     */
    function renderRevenueCard(yoyData, revenueData, period) {
        const revenueValue = document.getElementById('ytdRevenue');
        const growthBadge = document.getElementById('ytdGrowth');
        const titleEl = document.getElementById('revenueTitle');
        const dateDisplay = document.getElementById('dateRangeDisplay');
        const comparisonLabel = document.getElementById('comparisonLabel');

        // Update title based on period
        if (titleEl && period) {
            titleEl.textContent = `Revenue: ${getPeriodLabel(period)}`;
        }

        // Handle null data
        if (!yoyData) {
            if (revenueValue) {
                revenueValue.innerHTML = '<span class="no-data">--</span>';
            }
            if (growthBadge) {
                growthBadge.style.display = 'none';
            }
            if (dateDisplay) {
                dateDisplay.textContent = '';
            }
            return;
        }

        // Show revenue value
        if (revenueValue) {
            revenueValue.textContent = StaffDashboardService.formatCurrency(yoyData.currentYear.revenue);
        }

        // Show current date range
        if (dateDisplay && yoyData.currentYear?.dateRange) {
            const dr = yoyData.currentYear.dateRange;
            dateDisplay.textContent = `${dr.startFormatted} - ${dr.endFormatted}`;
        }

        // Show growth badge with comparison dates
        if (growthBadge) {
            const growth = yoyData.growth.revenue;
            // Handle null growth (no comparison data available)
            if (growth === null || !yoyData.hasComparison) {
                growthBadge.className = 'metrics-comparison-badge neutral';
                growthBadge.innerHTML = `<span>N/A</span>`;
                if (comparisonLabel) {
                    comparisonLabel.textContent = 'vs last year (no data)';
                }
            } else {
                const isPositive = growth >= 0;
                const diff = yoyData.growth.revenueDifference;
                const diffFormatted = StaffDashboardService.formatCurrency(Math.abs(diff));
                const diffSign = diff >= 0 ? '+' : '-';
                growthBadge.className = `metrics-comparison-badge ${isPositive ? 'positive' : 'negative'}`;
                growthBadge.innerHTML = `
                    <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
                    ${StaffDashboardService.formatPercentage(growth)} (${diffSign}${diffFormatted})
                `;
                // Show comparison dates
                if (comparisonLabel && yoyData.lastYear?.dateRange) {
                    const ldr = yoyData.lastYear.dateRange;
                    comparisonLabel.textContent = `vs ${ldr.startFormatted} - ${ldr.endFormatted}`;
                }
            }
        }
    }

    /**
     * Render team performance list with YoY comparisons
     */
    function renderTeamPerformance(teamData) {
        const container = document.getElementById('salesTeamList');
        const titleEl = document.getElementById('teamPerformanceTitle');
        const dateRangeEl = document.getElementById('teamDateRange');

        // Update title and date range
        if (titleEl && teamData && teamData.period) {
            titleEl.textContent = `Team Performance: ${teamData.period}`;
        }
        if (dateRangeEl && teamData && teamData.dateRange) {
            dateRangeEl.textContent = `${teamData.dateRange.startFormatted} - ${teamData.dateRange.endFormatted}`;
        }

        if (!container) return;

        // Handle null data
        if (!teamData) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="empty-state-title">Unable to load team data</div>
                    <div class="empty-state-message">Please try refreshing the page.</div>
                </div>
            `;
            return;
        }

        if (teamData.reps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="empty-state-title">No sales data</div>
                    <div class="empty-state-message">No orders found for this period.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = teamData.reps.map(rep => {
            // Build subtitle for "Other" group
            const otherSubtitle = rep.name === 'Other' && rep.firstNamesDisplay
                ? `<div class="rep-subtitle">${escapeHtml(rep.firstNamesDisplay)}</div>`
                : '';

            // Build YoY display
            let yoyDisplay = '';
            if (rep.revenueGrowth !== undefined) {
                // Has last year data - show comparison
                const isPositive = rep.revenueGrowth >= 0;
                const sign = rep.revenueDiff >= 0 ? '+' : '';
                const diffFormatted = StaffDashboardService.formatCurrency(Math.abs(rep.revenueDiff));
                yoyDisplay = `<div class="rep-yoy ${isPositive ? 'positive' : 'negative'}">
                    ${StaffDashboardService.formatPercentage(rep.revenueGrowth)} (${sign}${diffFormatted}) vs last year
                </div>`;
            } else if (rep.name === 'Taneisha Clark') {
                // Taneisha started Aug 2025 - show when YoY will be available
                yoyDisplay = `<div class="rep-yoy new">🚀 YoY coming Sept '26</div>`;
            } else if (rep.name !== 'Other' && rep.name !== 'House') {
                // Other new reps - generic message
                yoyDisplay = `<div class="rep-yoy new">🚀 New in 2025</div>`;
            }

            return `
            <div class="rep-card">
                <div class="rep-info">
                    <div class="rep-avatar">${rep.initials}</div>
                    <div class="rep-name-group">
                        <span class="rep-name">${escapeHtml(rep.name)}</span>
                        ${otherSubtitle}
                        ${yoyDisplay}
                    </div>
                </div>
                <div class="rep-progress">
                    <div class="rep-progress-bar" style="width: ${rep.percentage}%"></div>
                </div>
                <div class="rep-stats">
                    <div class="rep-revenue">${rep.formattedRevenue}</div>
                    <div class="rep-orders">${rep.orders} orders</div>
                </div>
            </div>
        `}).join('');
    }

    /**
     * Render team performance list for YTD (no YoY comparisons)
     * Fresh start for 2026 - shows only current year totals
     */
    function renderTeamPerformanceYTD(teamData) {
        const container = document.getElementById('salesTeamList');
        const titleEl = document.getElementById('teamPerformanceTitle');
        const dateRangeEl = document.getElementById('teamDateRange');

        // Update title to show 2026 YTD
        if (titleEl) {
            titleEl.innerHTML = '<i class="fas fa-users"></i> Team Performance: 2026 YTD';
        }
        if (dateRangeEl && teamData && teamData.dateRange) {
            dateRangeEl.textContent = `${teamData.dateRange.startFormatted} - ${teamData.dateRange.endFormatted}`;
        }

        if (!container) return;

        // Handle null data
        if (!teamData) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="empty-state-title">Unable to load team data</div>
                    <div class="empty-state-message">Please try refreshing the page.</div>
                </div>
            `;
            return;
        }

        if (teamData.reps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="empty-state-title">No sales data</div>
                    <div class="empty-state-message">No orders found for 2026 yet.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = teamData.reps.map(rep => {
            // Build subtitle for "Other" group
            const otherSubtitle = rep.name === 'Other' && rep.firstNamesDisplay
                ? `<div class="rep-subtitle">${escapeHtml(rep.firstNamesDisplay)}</div>`
                : '';

            // No YoY display for YTD view - clean slate for 2026

            return `
            <div class="rep-card">
                <div class="rep-info">
                    <div class="rep-avatar">${rep.initials}</div>
                    <div class="rep-name-group">
                        <span class="rep-name">${escapeHtml(rep.name)}</span>
                        ${otherSubtitle}
                    </div>
                </div>
                <div class="rep-progress">
                    <div class="rep-progress-bar" style="width: ${rep.percentage}%"></div>
                </div>
                <div class="rep-stats">
                    <div class="rep-revenue">${rep.formattedRevenue}</div>
                    <div class="rep-orders">${rep.orders} orders</div>
                </div>
            </div>
        `}).join('');
    }

    /**
     * Update data source badge
     */
    function updateDataSourceBadge(hasPartialData = false) {
        const badge = document.getElementById('dataSourceBadge');
        if (badge) {
            badge.className = `data-source-badge${hasPartialData ? ' partial' : ''}`;
            badge.innerHTML = `
                <i class="fas fa-database"></i>
                <span>ShopWorks Live${hasPartialData ? ' (Partial)' : ''}</span>
            `;
        }
    }

    /**
     * Update last refresh time display
     */
    function updateLastRefreshTime() {
        const lastUpdated = document.getElementById('lastUpdated');
        if (lastUpdated) {
            const now = new Date();
            lastUpdated.textContent = `Updated ${now.toLocaleTimeString()}`;
        }
    }

    // =====================================================
    // AUTO-REFRESH
    // =====================================================

    /**
     * Start auto-refresh timer
     */
    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        refreshTimer = setInterval(() => {
            loadMetrics(true);
        }, CONFIG.refreshInterval);
    }

    /**
     * Stop auto-refresh timer
     */
    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Manual refresh button handler
     */
    async function refresh() {
        const btn = document.querySelector('.refresh-btn');
        if (btn) {
            btn.classList.add('loading');
        }

        await loadMetrics(true);

        if (btn) {
            btn.classList.remove('loading');
        }
    }

    // =====================================================
    // SALES GOAL TRACKER
    // =====================================================

    const SALES_GOAL_2026 = 3000000; // $3 Million goal

    /**
     * Update the 2026 sales goal progress banner
     * @param {number} ytdRevenue - Year-to-date revenue
     */
    function updateSalesGoal(ytdRevenue) {
        const progressFill = document.getElementById('goalProgress');
        const currentEl = document.getElementById('goalCurrent');
        const percentEl = document.getElementById('goalPercent');

        if (!progressFill || !currentEl || !percentEl) return;

        const revenue = ytdRevenue || 0;
        const percent = Math.min((revenue / SALES_GOAL_2026) * 100, 100);

        // Update progress bar
        progressFill.style.width = `${percent}%`;

        // Update current amount
        currentEl.textContent = StaffDashboardService.formatCurrency(revenue);

        // Update percentage
        percentEl.textContent = percent.toFixed(1);
    }

    /**
     * Fetch YTD revenue for sales goal using HYBRID approach:
     * - Last 60 days: Live from ManageOrders (source of truth, handles invoice updates)
     * - Older than 60 days: Caspio archive (permanent storage)
     *
     * This ensures invoice changes within 60 days are always reflected,
     * while historical data is preserved forever in Caspio.
     */
    async function loadYTDForSalesGoal() {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const yearStart = `${year}-01-01`;
            const todayStr = today.toISOString().split('T')[0];

            // Calculate 60-day boundary
            const sixtyDaysAgo = new Date(today);
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const boundaryDate = sixtyDaysAgo.toISOString().split('T')[0];

            let ytdRevenue = 0;

            // Part 1: Archived data OLDER than 60 days (from Caspio)
            // Only applies after ~March 1 when Jan data starts expiring
            if (boundaryDate > yearStart) {
                try {
                    const archivedData = await StaffDashboardService.fetchArchivedSales(
                        yearStart,
                        boundaryDate
                    );
                    ytdRevenue += archivedData.summary?.totalRevenue || 0;
                    console.log(`YTD Archive (${yearStart} to ${boundaryDate}): $${(archivedData.summary?.totalRevenue || 0).toFixed(2)}`);
                } catch (e) {
                    console.warn('Could not fetch archived data:', e.message);
                }
            }

            // Part 2: Live data from last 60 days (from ManageOrders - source of truth)
            const liveStartDate = boundaryDate > yearStart ? boundaryDate : yearStart;
            try {
                const liveOrders = await StaffDashboardService.fetchOrders(liveStartDate, todayStr);
                const liveRevenue = liveOrders.reduce((sum, o) =>
                    sum + (parseFloat(o.cur_SubTotal) || 0), 0);
                ytdRevenue += liveRevenue;
                console.log(`YTD Live (${liveStartDate} to ${todayStr}): $${liveRevenue.toFixed(2)} from ${liveOrders.length} orders`);
            } catch (e) {
                console.error('Could not fetch live data:', e.message);
            }

            // Part 3: Archive any days about to fall off (55-60 days ago)
            // This runs in background, doesn't block the UI update
            archiveSoonToExpireDays().catch(e =>
                console.warn('Background archiving failed:', e.message)
            );

            // Part 4: Archive per-rep data for days about to fall off
            // For YTD team performance tracking beyond 60-day limit
            archivePerRepSoonToExpireDays().catch(e =>
                console.warn('[PerRep] Background archiving failed:', e.message)
            );

            // Update banner
            console.log(`YTD Total: $${ytdRevenue.toFixed(2)}`);
            updateSalesGoal(ytdRevenue);
        } catch (error) {
            console.error('Failed to load YTD for sales goal:', error);
            updateSalesGoal(0);
        }
    }

    /**
     * Archive days 55-60 ago to ensure they're saved before falling off
     * ManageOrders' 60-day retention window.
     * Runs in background on dashboard load.
     */
    async function archiveSoonToExpireDays() {
        const today = new Date();
        const year = today.getFullYear();
        let archivedCount = 0;

        // Archive days 55-60 ago (buffer before 60-day cutoff)
        for (let daysAgo = 55; daysAgo <= 60; daysAgo++) {
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);
            const dateStr = date.toISOString().split('T')[0];

            // Only archive if in current year
            if (date.getFullYear() !== year) continue;

            try {
                // Fetch from ManageOrders
                const orders = await StaffDashboardService.fetchOrders(dateStr, dateStr);
                const revenue = orders.reduce((sum, o) =>
                    sum + (parseFloat(o.cur_SubTotal) || 0), 0);

                // Archive to Caspio (will update if exists, create if not)
                await StaffDashboardService.archiveDailySales(dateStr, revenue, orders.length);
                archivedCount++;
            } catch (e) {
                // Individual day failures are okay, continue with others
                console.warn(`Could not archive ${dateStr}:`, e.message);
            }
        }

        if (archivedCount > 0) {
            console.log(`Archived ${archivedCount} days (55-60 days ago) to Caspio`);
        }
    }

    /**
     * Archive per-rep daily sales for days 55-60 ago
     * Similar to archiveSoonToExpireDays but breaks down by sales rep
     * for YTD team performance tracking.
     */
    async function archivePerRepSoonToExpireDays() {
        const today = new Date();
        const year = today.getFullYear();
        let archivedCount = 0;

        for (let daysAgo = 55; daysAgo <= 60; daysAgo++) {
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);
            const dateStr = date.toISOString().split('T')[0];

            // Only archive if in current year
            if (date.getFullYear() !== year) continue;

            try {
                // Fetch orders for this day
                const orders = await StaffDashboardService.fetchOrders(dateStr, dateStr);

                // Aggregate by rep using existing normalization
                const repTotals = {};
                for (const order of orders) {
                    // Use CustomerServiceRep field (same as processTeamPerformanceYTD)
                    const repName = StaffDashboardService.normalizeRepName(order.CustomerServiceRep) || 'Other';
                    if (!repTotals[repName]) {
                        repTotals[repName] = { revenue: 0, orderCount: 0 };
                    }
                    repTotals[repName].revenue += parseFloat(order.cur_SubTotal) || 0;
                    repTotals[repName].orderCount++;
                }

                // Format for API
                const reps = Object.entries(repTotals).map(([name, data]) => ({
                    name,
                    revenue: Math.round(data.revenue * 100) / 100,
                    orderCount: data.orderCount
                }));

                // Archive to Caspio
                if (reps.length > 0) {
                    await StaffDashboardService.archivePerRepDailySales(dateStr, reps);
                    archivedCount++;
                }
            } catch (e) {
                console.warn(`[PerRep] Could not archive ${dateStr}:`, e.message);
            }
        }

        if (archivedCount > 0) {
            console.log(`[PerRep] Archived ${archivedCount} days (55-60 days ago) to Caspio`);
        }
    }

    /**
     * Load team performance YTD using hybrid approach:
     * Archived data from Caspio + live data from ManageOrders
     * Falls back to ManageOrders-only on failure.
     */
    async function loadTeamPerformanceYTDHybrid() {
        try {
            // 1. Get archived data from Caspio
            const archived = await StaffDashboardService.fetchYTDPerRepFromArchive();

            // 2. Determine what live data we need
            const lastArchived = archived.lastArchivedDate || '2025-12-31';
            const today = new Date().toISOString().split('T')[0];

            let liveRepTotals = {};

            // If there are days not yet archived, fetch from ManageOrders
            if (lastArchived < today) {
                const nextDay = new Date(lastArchived);
                nextDay.setDate(nextDay.getDate() + 1);
                const startDate = nextDay.toISOString().split('T')[0];

                console.log(`[TeamPerformance] Hybrid load: archived through ${lastArchived}, fetching live ${startDate} to ${today}`);

                const liveOrders = await StaffDashboardService.fetchOrders(startDate, today);

                // Aggregate by rep
                for (const order of liveOrders) {
                    const repName = StaffDashboardService.normalizeRepName(order.CustomerServiceRep) || 'Other';
                    if (!liveRepTotals[repName]) {
                        liveRepTotals[repName] = { revenue: 0, orders: 0 };
                    }
                    liveRepTotals[repName].revenue += parseFloat(order.cur_SubTotal) || 0;
                    liveRepTotals[repName].orders++;
                }
            }

            // 3. Merge archived + live totals
            const mergedTotals = {};

            // Add archived data
            for (const rep of (archived.reps || [])) {
                mergedTotals[rep.name] = {
                    revenue: rep.totalRevenue || 0,
                    orders: rep.totalOrders || 0
                };
            }

            // Add live data
            for (const [name, data] of Object.entries(liveRepTotals)) {
                if (!mergedTotals[name]) {
                    mergedTotals[name] = { revenue: 0, orders: 0 };
                }
                mergedTotals[name].revenue += data.revenue;
                mergedTotals[name].orders += data.orders;
            }

            // 4. Format for display (same structure as processTeamPerformanceYTD)
            const reps = Object.entries(mergedTotals)
                .filter(([name]) => name !== 'Unassigned')
                .map(([name, data]) => ({
                    name,
                    revenue: data.revenue,
                    orders: data.orders,
                    initials: StaffDashboardService.getInitials(name),
                    formattedRevenue: StaffDashboardService.formatCurrency(data.revenue)
                }))
                .sort((a, b) => b.revenue - a.revenue);

            // Calculate percentages
            const maxRevenue = reps[0]?.revenue || 1;
            reps.forEach(rep => {
                rep.percentage = Math.round((rep.revenue / maxRevenue) * 100);
            });

            console.log(`[TeamPerformance] Hybrid load complete: ${reps.length} reps, archived=${archived.reps?.length || 0}, live=${Object.keys(liveRepTotals).length}`);

            return {
                reps,
                totalReps: reps.length,
                topPerformer: reps[0] || null,
                period: '2026 YTD',
                dateRange: {
                    start: `${new Date().getFullYear()}-01-01`,
                    end: today,
                    startFormatted: 'Jan 1, 2026',
                    endFormatted: StaffDashboardService.formatDateForDisplay(today)
                },
                isHybrid: true,
                lastArchivedDate: lastArchived
            };
        } catch (e) {
            console.warn('[TeamPerformance] Hybrid load failed, falling back to ManageOrders-only:', e.message);
            // Fallback to existing ManageOrders-only approach
            const ytdRange = StaffDashboardService.getYTD2026Range();
            const ytdOrders = await StaffDashboardService.fetchOrders(ytdRange.start, ytdRange.end);
            return StaffDashboardService.processTeamPerformanceYTD(ytdOrders, ytdRange);
        }
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        init,
        loadMetrics,
        setDateRange,
        toggleWidget,
        refresh,
        stopAutoRefresh,

        // Expose config for external use
        CONFIG
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    StaffDashboardInit.init();
});

// Export for use
if (typeof window !== 'undefined') {
    window.StaffDashboardInit = StaffDashboardInit;
}
