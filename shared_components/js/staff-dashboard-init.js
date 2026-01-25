/* =====================================================
   STAFF DASHBOARD INITIALIZATION
   Main entry point for dashboard functionality
   ===================================================== */

const StaffDashboardInit = (function() {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultDateRange: 7, // Default to 7 days
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
        initPoliciesToggle();
        initDateRangeSelector();
        initDropdowns();

        // Load announcements (if data exists)
        loadAnnouncements();

        // Load YTD for sales goal banner
        loadYTDForSalesGoal();

        // Load metrics from ShopWorks
        await loadMetrics();

        // Load garment tracker (non-blocking, loads after main metrics)
        loadGarmentTracker();

        // Render production schedule predictor
        renderProductionSchedule();

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
     * Initialize policies toggle in Quick Access section
     * (Separate from main widget toggles since it's in tool-category format)
     */
    function initPoliciesToggle() {
        const header = document.querySelector('.policies-category .collapsible-header');
        const content = document.querySelector('.policies-category .policies-content');
        const icon = document.querySelector('.policies-category .toggle-icon');

        if (header && content) {
            header.addEventListener('click', () => {
                content.classList.toggle('collapsed');
                icon?.classList.toggle('rotated');

                // Save state to localStorage
                const isCollapsed = content.classList.contains('collapsed');
                localStorage.setItem('staffDashboard_policiesCollapsed', isCollapsed);
            });

            // Load saved state (default: collapsed)
            const savedState = localStorage.getItem('staffDashboard_policiesCollapsed');
            if (savedState === 'false') {
                content.classList.remove('collapsed');
                icon?.classList.add('rotated');
            }
        }
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

            // Fetch CRM account totals for Nika and Taneisha (for dual metrics display)
            // This shows "Account Sales" alongside "Orders Processed"
            try {
                const crmTotals = await StaffDashboardService.fetchRepCRMTotals();
                // Merge CRM data into team performance data
                teamDataYTD.reps.forEach(rep => {
                    const crmData = crmTotals[rep.name];
                    if (crmData) {
                        rep.accountSales = crmData.totalSales;
                        rep.accountCount = crmData.accountCount;
                    }
                });
            } catch (crmError) {
                console.warn('Could not fetch CRM totals:', crmError.message);
                // Continue without CRM data - will just show "Orders Processed"
            }

            // Render revenue (uses metrics.yoy for the selected period)
            renderRevenueCard(metrics.yoy, metrics.revenue, metrics.period);

            // Render team with YTD data (includes CRM account sales if available)
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

            // Build account sales display if CRM data is available
            // Two types of gaps:
            // 1. Processed > Accounts: Rep wrote orders for customers NOT in their CRM
            // 2. Accounts > Processed: OTHER reps wrote orders for customers IN their CRM
            const processedAmount = parseFloat(rep.revenue) || 0;
            const accountsAmount = rep.accountSales || 0;
            const hasCrmData = rep.accountSales !== null && rep.accountSales !== undefined;
            const hasGap = hasCrmData && processedAmount > accountsAmount;
            const hasReverseGap = hasCrmData && accountsAmount > processedAmount;

            let gapButtonHtml = '';
            if (hasGap) {
                // Orders BY this rep for customers NOT in their CRM
                gapButtonHtml = `<button class="gap-details-btn gap-outbound" onclick="showGapReport('${escapeHtml(rep.name)}', 'outbound')" title="Orders you wrote for non-CRM customers">
                       <i class="fas fa-arrow-right"></i>
                   </button>`;
            } else if (hasReverseGap) {
                // Orders by OTHER reps for customers IN this rep's CRM
                gapButtonHtml = `<button class="gap-details-btn gap-inbound" onclick="showGapReport('${escapeHtml(rep.name)}', 'inbound')" title="Orders other reps wrote for your customers">
                       <i class="fas fa-arrow-left"></i>
                   </button>`;
            }

            const accountSalesHtml = hasCrmData
                ? `<div class="rep-account-sales-group">
                       <div class="rep-account-sales">${StaffDashboardService.formatCurrency(rep.accountSales)}</div>
                       <div class="rep-account-sales-label">accounts</div>
                       ${gapButtonHtml}
                   </div>`
                : '';

            // If we have account sales, show "processed" label under orders total
            const revenueLabel = accountSalesHtml
                ? `<div class="rep-revenue-label">processed</div>`
                : '';

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
                    <div class="rep-revenue-group">
                        <div class="rep-revenue">${rep.formattedRevenue}</div>
                        ${revenueLabel}
                    </div>
                    ${accountSalesHtml}
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
    // GARMENT TRACKER
    // Premium garment tracking for Nika and Taneisha
    // =====================================================

    /**
     * Load and render garment tracker widget
     * Tries table-based method first (fast), falls back to legacy if table is empty
     */
    async function loadGarmentTracker() {
        const container = document.getElementById('garmentTrackerContent');
        if (!container) return;

        try {
            // Try fast table-based load first
            const data = await StaffDashboardService.loadGarmentTrackerFromTable();
            console.log('[GarmentTracker] Loaded from table');
            renderGarmentTracker(data);
        } catch (error) {
            console.warn('[GarmentTracker] Table load failed, showing sync prompt:', error.message);
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-state-icon"><i class="fas fa-cloud-download-alt"></i></div>
                    <div class="error-state-content">
                        <div class="error-state-title">No data synced yet</div>
                        <div class="error-state-message">Click the Sync button to populate from orders</div>
                        <button class="error-state-retry" onclick="StaffDashboardInit.syncGarmentTracker()">
                            <i class="fas fa-cloud-download-alt"></i> Sync Now
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render garment tracker data as a table
     * @param {Object} data - Tracker data from loadGarmentTrackerData
     */
    function renderGarmentTracker(data) {
        const container = document.getElementById('garmentTrackerContent');
        const dateRangeEl = document.getElementById('garmentTrackerDateRange');

        if (!container || !data) return;

        const config = StaffDashboardService.GARMENT_TRACKER_CONFIG;
        const reps = config.trackedReps;

        // Update date range display
        if (dateRangeEl && data.metadata?.dateRange) {
            const dr = data.metadata.dateRange;
            dateRangeEl.textContent = `${StaffDashboardService.formatDateForDisplay(dr.start)} - ${StaffDashboardService.formatDateForDisplay(dr.end)}`;
        }

        // Get first names for column headers
        const getFirstName = (fullName) => fullName.split(' ')[0];

        // Build table HTML
        let html = `
            <div class="garment-tracker-table-wrapper">
                <table class="garment-tracker-table">
                    <thead>
                        <tr>
                            <th class="garment-name-col">Style</th>
                            ${reps.map(rep => `<th class="rep-col">${getFirstName(rep)}</th>`).join('')}
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Premium items rows
        config.premiumItems.forEach(item => {
            const totalQty = data.totals.premium[item.partNumber] || 0;
            const hasData = totalQty > 0;

            html += `
                <tr class="${hasData ? '' : 'no-data'}" title="${item.bonus} per item">
                    <td class="garment-name-col">
                        <div class="garment-info">
                            <span class="garment-style">${escapeHtml(item.partNumber)}</span>
                            <span class="garment-name">${escapeHtml(item.name)}</span>
                        </div>
                    </td>
                    ${reps.map(rep => {
                        const qty = data.byRep[rep]?.premium[item.partNumber] || 0;
                        return `<td class="rep-col ${qty > 0 ? 'has-qty' : ''}">${qty || '-'}</td>`;
                    }).join('')}
                    <td class="total-col ${hasData ? 'has-qty' : ''}">${totalQty || '-'}</td>
                </tr>
            `;
        });

        // Richardson row (grouped)
        const richardsonTotal = data.totals.richardson || 0;
        html += `
            <tr class="richardson-row ${richardsonTotal > 0 ? '' : 'no-data'}" title="${config.richardsonBonus} per cap">
                <td class="garment-name-col">
                    <div class="garment-info">
                        <span class="garment-style">Richardson</span>
                        <span class="garment-name">SanMar Caps (112, 168, etc.)</span>
                    </div>
                </td>
                ${reps.map(rep => {
                    const qty = data.byRep[rep]?.richardson || 0;
                    return `<td class="rep-col ${qty > 0 ? 'has-qty' : ''}">${qty || '-'}</td>`;
                }).join('')}
                <td class="total-col ${richardsonTotal > 0 ? 'has-qty' : ''}">${richardsonTotal || '-'}</td>
            </tr>
        `;

        // Bonus totals row at bottom with progress bars toward $500 goal
        const BONUS_GOAL = 500;
        html += `
            <tr class="bonus-row">
                <td class="garment-name-col"></td>
                ${reps.map(rep => {
                    const bonusTotal = data.bonusTotals[rep] || 0;
                    const percentage = Math.min((bonusTotal / BONUS_GOAL) * 100, 100);
                    const isGoalReached = bonusTotal >= BONUS_GOAL;
                    const goalClass = isGoalReached ? 'goal-reached' : '';

                    return `<td class="rep-col bonus-cell ${goalClass}" title="$500 bonus goal - paid out on next paycheck when reached">
                        <div class="bonus-amount">$${bonusTotal.toFixed(2)}</div>
                        <div class="bonus-progress">
                            <div class="bonus-progress-bar">
                                <div class="bonus-progress-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span class="bonus-progress-label">
                                ${isGoalReached ? '✓ GOAL!' : Math.round(percentage) + '%'}
                            </span>
                        </div>
                    </td>`;
                }).join('')}
                <td class="total-col"></td>
            </tr>
        `;

        html += `
                    </tbody>
                </table>
            </div>
            <div class="garment-tracker-footer">
                <span class="garment-tracker-meta">
                    ${data.metadata.ordersProcessed} of ${data.metadata.totalOrders} orders processed
                </span>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Refresh garment tracker from table (manual)
     */
    async function refreshGarmentTracker() {
        const btn = document.querySelector('.garment-tracker-card .refresh-btn');
        if (btn) btn.classList.add('loading');

        // Show loading state
        const container = document.getElementById('garmentTrackerContent');
        if (container) {
            container.innerHTML = `
                <div class="metrics-loading">
                    <div class="loading"></div>
                    <span>Refreshing from table...</span>
                </div>
            `;
        }

        await loadGarmentTracker();

        if (btn) btn.classList.remove('loading');
    }

    /**
     * Sync garment tracker from ManageOrders to Caspio table
     */
    async function syncGarmentTracker() {
        const statusEl = document.getElementById('garmentSyncStatus');
        const syncBtn = document.querySelector('.garment-tracker-card .sync-btn');
        const container = document.getElementById('garmentTrackerContent');

        if (syncBtn) {
            syncBtn.disabled = true;
            const icon = syncBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-spinner fa-spin';
        }

        if (container) {
            container.innerHTML = `
                <div class="metrics-loading">
                    <div class="loading"></div>
                    <span id="syncProgressText">Starting sync...</span>
                </div>
            `;
        }

        try {
            const count = await StaffDashboardService.syncGarmentTracker((msg) => {
                if (statusEl) statusEl.textContent = msg;
                const progressEl = document.getElementById('syncProgressText');
                if (progressEl) progressEl.textContent = msg;
            });

            if (statusEl) statusEl.textContent = `Synced ${count} items`;
            console.log(`[GarmentTracker] Sync complete: ${count} items`);

            // Reload from table
            await loadGarmentTracker();
        } catch (error) {
            console.error('[GarmentTracker] Sync failed:', error);
            if (statusEl) statusEl.textContent = 'Sync failed!';
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <div class="error-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <div class="error-state-content">
                            <div class="error-state-title">Sync failed</div>
                            <div class="error-state-message">${escapeHtml(error.message)}</div>
                            <button class="error-state-retry" onclick="StaffDashboardInit.syncGarmentTracker()">Try again</button>
                        </div>
                    </div>
                `;
            }
        } finally {
            if (syncBtn) {
                syncBtn.disabled = false;
                const icon = syncBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-cloud-download-alt';
            }
        }
    }

    // =====================================================
    // PRODUCTION SCHEDULE PREDICTOR
    // Historical-based turnaround predictions
    // =====================================================

    /**
     * Render production schedule predictions
     * Uses ProductionPredictor module with precomputed stats
     */
    function renderProductionSchedule() {
        const container = document.getElementById('production-predictor-grid');
        const seasonBadge = document.getElementById('production-season-badge');
        const recordCount = document.getElementById('production-record-count');

        if (!container) return;

        // Check if predictor is available
        if (typeof ProductionPredictor === 'undefined') {
            console.warn('ProductionPredictor not loaded');
            container.innerHTML = '<div class="production-loading">Predictor not available</div>';
            return;
        }

        // Get all predictions for current date
        const predictions = ProductionPredictor.getAllPredictions();
        const metadata = ProductionPredictor.getMetadata();

        // Update record count
        if (recordCount && metadata.totalRecords) {
            recordCount.textContent = metadata.totalRecords;
        }

        // Update season badge
        if (seasonBadge) {
            const seasonText = ProductionPredictor.getSeasonText(predictions.season);
            seasonBadge.className = `season-badge season-${predictions.season}`;
            seasonBadge.textContent = seasonText;
        }

        // Define services to display (using Font Awesome Free icons)
        const services = [
            { key: 'dtg', icon: 'fa-tshirt' },
            { key: 'embroidery', icon: 'fa-star' },
            { key: 'capEmbroidery', icon: 'fa-hard-hat' },
            { key: 'screenprint', icon: 'fa-print' },
            { key: 'transfers', icon: 'fa-exchange-alt' }
        ];

        // Build cards HTML
        let html = '';
        services.forEach(service => {
            const pred = predictions[service.key];
            const name = ProductionPredictor.getServiceName(service.key);
            const capacityClass = getCapacityClass(predictions.capacity.status);

            html += `
                <div class="production-card" title="Typically ${pred.range} days (${pred.samples} samples)">
                    <div class="production-card-header">
                        <i class="fas ${service.icon}"></i>
                        <span class="production-service-name">${name}</span>
                    </div>
                    <div class="production-days">
                        <span class="production-days-number">${pred.days}</span>
                        <span class="production-days-label">days</span>
                    </div>
                    <div class="production-due-date">${pred.dueDateFormatted}</div>
                    <div class="production-capacity-dot ${capacityClass}"></div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Get CSS class for capacity indicator
     */
    function getCapacityClass(status) {
        switch (status) {
            case 'wide-open': return 'capacity-open';
            case 'moderate': return 'capacity-moderate';
            case 'busy': return 'capacity-busy';
            default: return 'capacity-open';
        }
    }

    // =====================================================
    // GAP REPORT - Show orders causing discrepancy
    // =====================================================

    /**
     * Show gap report modal for a specific rep
     * @param {string} repName - The rep name (e.g., "Nika Lao")
     * @param {string} gapType - 'outbound' (orders BY rep for non-CRM) or 'inbound' (orders by OTHERS for CRM)
     */
    async function showGapReport(repName, gapType = 'outbound') {
        // Create modal if it doesn't exist
        let modal = document.getElementById('gapReportModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gapReportModal';
            modal.className = 'gap-report-modal-overlay';
            modal.innerHTML = `
                <div class="gap-report-modal">
                    <div class="gap-report-header">
                        <h2 id="gapReportTitle"><i class="fas fa-info-circle"></i> Gap Details</h2>
                        <button class="gap-report-close" onclick="closeGapReport()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="gap-report-body" id="gapReportBody">
                        <div class="gap-report-loading">
                            <div class="loading"></div>
                            <p>Loading gap details...</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeGapReport();
            });
        }

        // Show modal and set loading state
        modal.classList.add('show');
        const body = document.getElementById('gapReportBody');
        const title = document.getElementById('gapReportTitle');
        body.innerHTML = `<div class="gap-report-loading"><div class="loading"></div><p>Loading gap details...</p></div>`;

        // Determine endpoint and labels based on gap type
        const isInbound = gapType === 'inbound';
        let endpoint;
        const repFirstName = repName.split(' ')[0].toLowerCase();

        if (repName === 'Nika Lao' || repName === 'Taneisha Clark') {
            endpoint = isInbound
                ? `/api/crm-proxy/${repFirstName}-accounts/reverse-gap-report`
                : `/api/crm-proxy/${repFirstName}-accounts/gap-report`;
        } else {
            body.innerHTML = `<div class="gap-report-error">Gap report not available for ${escapeHtml(repName)}</div>`;
            return;
        }

        // Update title based on gap type
        title.innerHTML = isInbound
            ? `<i class="fas fa-arrow-left"></i> Orders From Other Reps`
            : `<i class="fas fa-arrow-right"></i> Orders to Non-CRM Customers`;

        try {
            const response = await fetch(endpoint, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (!data.success) throw new Error(data.error || 'Unknown error');

            // Get the appropriate data fields based on gap type
            const gapAmount = isInbound ? data.reverseGapAmount : data.gapAmount;
            const gapOrderCount = isInbound ? data.reverseGapOrderCount : data.gapOrderCount;
            const gapCustomerCount = isInbound ? data.reverseGapCustomerCount : data.gapCustomerCount;

            if (data.customers.length === 0) {
                body.innerHTML = `
                    <div class="gap-report-empty">
                        <i class="fas fa-check-circle"></i>
                        <h3>No Gap!</h3>
                        <p>${isInbound
                            ? `No orders by other reps for ${escapeHtml(repName)}'s customers.`
                            : `All orders by ${escapeHtml(repName)} are for customers in their account list.`
                        }</p>
                    </div>
                `;
                return;
            }

            // Set subtitle based on gap type
            const subtitle = isInbound
                ? `Orders by <strong>other reps</strong> for customers in ${escapeHtml(repName)}'s CRM`
                : `Orders by ${escapeHtml(repName)} for customers <strong>NOT</strong> in their CRM`;

            const footerText = isInbound
                ? `To fix: Change order rep in ShopWorks to ${escapeHtml(repName)} OR remove customer from CRM`
                : `To fix: Add customer to ${escapeHtml(repName)}'s CRM OR change order rep in ShopWorks`;

            // Build order items - include rep name for inbound reports
            const buildOrderItems = (orders) => orders.map(order => `
                <div class="gap-order-item">
                    <span class="gap-order-number">#${escapeHtml(String(order.orderNumber))}</span>
                    <span class="gap-order-amount">${StaffDashboardService.formatCurrency(order.amount)}</span>
                    <span class="gap-order-date">${escapeHtml(order.date)}</span>
                    ${isInbound && order.rep ? `<span class="gap-order-rep">${escapeHtml(order.rep)}</span>` : ''}
                </div>
            `).join('');

            // Render gap report
            body.innerHTML = `
                <div class="gap-report-subtitle">${subtitle}</div>
                <div class="gap-report-summary">
                    <div class="gap-stat">
                        <div class="gap-stat-value">${StaffDashboardService.formatCurrency(gapAmount)}</div>
                        <div class="gap-stat-label">Gap Amount</div>
                    </div>
                    <div class="gap-stat">
                        <div class="gap-stat-value">${gapOrderCount}</div>
                        <div class="gap-stat-label">Orders</div>
                    </div>
                    <div class="gap-stat">
                        <div class="gap-stat-value">${gapCustomerCount}</div>
                        <div class="gap-stat-label">Customers</div>
                    </div>
                </div>
                <div class="gap-report-table-wrapper">
                    <table class="gap-report-table">
                        <thead>
                            <tr>
                                <th class="expand-col"></th>
                                <th>Company</th>
                                ${isInbound ? '<th>Other Reps</th>' : ''}
                                <th>Orders</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.customers.map(cust => `
                                <tr class="gap-customer-row" onclick="toggleGapOrders(this)">
                                    <td class="expand-toggle"><i class="fas fa-chevron-right"></i></td>
                                    <td>
                                        <div class="gap-company-name">${escapeHtml(cust.companyName)}</div>
                                        <div class="gap-customer-id">ID: ${cust.ID_Customer}</div>
                                    </td>
                                    ${isInbound ? `<td class="gap-rep-names">${(cust.repNames || []).map(r => escapeHtml(r)).join(', ')}</td>` : ''}
                                    <td>${cust.orderCount}</td>
                                    <td>${StaffDashboardService.formatCurrency(cust.totalSales)}</td>
                                </tr>
                                <tr class="gap-orders-row" style="display: none;">
                                    <td colspan="${isInbound ? 5 : 4}">
                                        <div class="gap-order-list">
                                            ${buildOrderItems(cust.orders)}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="gap-report-footer">
                    <p><i class="fas fa-info-circle"></i> ${footerText}</p>
                </div>
            `;
        } catch (error) {
            console.error('Gap report error:', error);
            body.innerHTML = `
                <div class="gap-report-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load gap report: ${escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }

    /**
     * Close the gap report modal
     */
    function closeGapReport() {
        const modal = document.getElementById('gapReportModal');
        if (modal) modal.classList.remove('show');
    }

    /**
     * Toggle order details row in gap report
     */
    function toggleGapOrders(row) {
        const detailsRow = row.nextElementSibling;
        const icon = row.querySelector('.expand-toggle i');
        if (detailsRow && detailsRow.classList.contains('gap-orders-row')) {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';
            if (icon) {
                icon.classList.toggle('fa-chevron-right', !isHidden);
                icon.classList.toggle('fa-chevron-down', isHidden);
            }
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

        // Garment Tracker
        loadGarmentTracker,
        refreshGarmentTracker,
        syncGarmentTracker,

        // Production Schedule
        renderProductionSchedule,

        // Gap Report
        showGapReport,
        closeGapReport,
        toggleGapOrders,

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

    // Global functions for onclick handlers
    window.showGapReport = (repName, gapType) => StaffDashboardInit.showGapReport(repName, gapType);
    window.closeGapReport = () => StaffDashboardInit.closeGapReport();
    window.toggleGapOrders = (row) => StaffDashboardInit.toggleGapOrders(row);
}
