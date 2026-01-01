/* =====================================================
   STAFF DASHBOARD SERVICE
   ShopWorks ManageOrders API Integration
   Fetches real-time sales metrics from production system
   ===================================================== */

const StaffDashboardService = (function() {
    'use strict';

    // API Configuration
    const API_CONFIG = {
        baseURL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        endpoints: {
            orders: '/manageorders/orders',
            customers: '/manageorders/customers',
            payments: '/manageorders/payments'
        },
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        cacheKey: 'staffDashboard_metricsCache'
    };

    // State
    let lastFetchTime = null;
    let cachedData = null;
    let isLoading = false;

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    /**
     * Format date as YYYY-MM-DD for API queries
     */
    function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get date range for queries
     */
    function getDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    }

    /**
     * Get YTD date range - LIMITED to 60 days max to avoid API timeouts
     * The ManageOrders API times out on large date ranges
     */
    function getYTDRange() {
        // Use 60 days instead of full YTD - API can't handle full year
        return getDateRange(60);
    }

    /**
     * Get last year's same period for comparison (dynamic days, same dates last year)
     * Fixed: Properly handles year boundary crossing (e.g., Dec 25 to Jan 1)
     */
    function getLastYearRangeForDays(days) {
        // First calculate the current period dates
        const now = new Date();
        const currentEnd = new Date(now);
        const currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - days);

        // Then subtract exactly 1 year from each date
        const lastYearStart = new Date(currentStart);
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);

        const lastYearEnd = new Date(currentEnd);
        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

        return {
            start: formatDate(lastYearStart),
            end: formatDate(lastYearEnd)
        };
    }

    /**
     * Format currency
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    /**
     * Format percentage
     */
    function formatPercentage(value, includeSign = true) {
        const formatted = Math.abs(value).toFixed(1);
        if (includeSign) {
            return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
        }
        return `${formatted}%`;
    }

    /**
     * Format date for display (e.g., "Dec 1, 2025")
     */
    function formatDateForDisplay(dateStr) {
        const date = new Date(dateStr + 'T00:00:00'); // Ensure proper parsing
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Get initials from name
     */
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    /**
     * Name normalization map for sales reps with multiple database entries
     * Add entries here to consolidate variations of the same person
     */
    const REP_NAME_ALIASES = {
        'ruth nhoung': 'Ruthie Nhoung',
        'ruthie nhoung': 'Ruthie Nhoung',
        'ruth': 'Ruthie Nhoung',
        'house': 'House'
    };

    /**
     * Low-volume reps to group under "Other"
     */
    const OTHER_REPS = [
        'jim mickelson',
        'dyonii quitugua',
        'erik mickelson',
        'adriyella trujillo'
    ];

    /**
     * Normalize sales rep name to handle database variations
     */
    function normalizeRepName(name) {
        if (!name) return 'Unassigned';
        // Normalize whitespace and case
        const cleaned = name.trim().replace(/\s+/g, ' ').toLowerCase();
        // Check if this rep should be grouped under "Other"
        if (OTHER_REPS.includes(cleaned)) return 'Other';
        return REP_NAME_ALIASES[cleaned] || name.trim();
    }

    /**
     * Check if a rep name is in the "Other" group
     */
    function isOtherRep(name) {
        if (!name) return false;
        const cleaned = name.trim().replace(/\s+/g, ' ').toLowerCase();
        return OTHER_REPS.includes(cleaned);
    }

    // =====================================================
    // API FUNCTIONS
    // =====================================================

    /**
     * Fetch orders from ShopWorks ManageOrders API
     * Uses date_Invoiced to get orders invoiced within the date range
     * (More accurate for sales reporting than date_Ordered)
     */
    async function fetchOrders(startDate, endDate, refresh = false) {
        const url = new URL(API_CONFIG.baseURL + API_CONFIG.endpoints.orders);
        url.searchParams.append('date_Invoiced_start', startDate);
        url.searchParams.append('date_Invoiced_end', endDate);
        if (refresh) {
            url.searchParams.append('refresh', 'true');
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.status}`);
        }
        const data = await response.json();
        return data.result || [];
    }

    /**
     * Load revenue data with YoY comparison
     */
    async function loadRevenueData(days = 30) {
        try {
            const dateRange = getDateRange(days);
            const orders = await fetchOrders(dateRange.start, dateRange.end);

            // Calculate totals
            let totalRevenue = 0;
            let totalOrders = orders.length;

            orders.forEach(order => {
                const subtotal = parseFloat(order.cur_SubTotal) || 0;
                totalRevenue += subtotal;
            });

            return {
                revenue: totalRevenue,
                orders: totalOrders,
                avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                period: days,
                dateRange: {
                    start: dateRange.start,
                    end: dateRange.end,
                    startFormatted: formatDateForDisplay(dateRange.start),
                    endFormatted: formatDateForDisplay(dateRange.end)
                }
            };
        } catch (error) {
            console.error('Error loading revenue data:', error);
            throw error;
        }
    }

    /**
     * Load YoY comparison data - Returns null on failure instead of throwing
     * Uses dynamic date range based on selected period
     */
    async function loadYearOverYear(days = 60) {
        try {
            // Get current period based on selected days
            const currentRange = getDateRange(days);
            const currentOrders = await fetchOrders(currentRange.start, currentRange.end);

            // Calculate last year's same period
            const lastYearRange = getLastYearRangeForDays(days);
            let lastYearOrders = [];
            try {
                lastYearOrders = await fetchOrders(lastYearRange.start, lastYearRange.end);
            } catch (e) {
                console.warn('Could not load last year data for comparison:', e.message);
                // Continue with empty last year data
            }

            // Calculate totals
            let currentRevenue = 0;
            let lastYearRevenue = 0;

            currentOrders.forEach(order => {
                currentRevenue += parseFloat(order.cur_SubTotal) || 0;
            });

            lastYearOrders.forEach(order => {
                lastYearRevenue += parseFloat(order.cur_SubTotal) || 0;
            });

            // Calculate growth (handle case where we don't have last year data)
            const revenueGrowth = lastYearRevenue > 0
                ? ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100
                : null; // null indicates no comparison available

            const orderGrowth = lastYearOrders.length > 0
                ? ((currentOrders.length - lastYearOrders.length) / lastYearOrders.length) * 100
                : null;

            return {
                currentYear: {
                    revenue: currentRevenue,
                    orders: currentOrders.length,
                    dateRange: {
                        start: currentRange.start,
                        end: currentRange.end,
                        startFormatted: formatDateForDisplay(currentRange.start),
                        endFormatted: formatDateForDisplay(currentRange.end)
                    }
                },
                lastYear: {
                    revenue: lastYearRevenue,
                    orders: lastYearOrders.length,
                    dateRange: {
                        start: lastYearRange.start,
                        end: lastYearRange.end,
                        startFormatted: formatDateForDisplay(lastYearRange.start),
                        endFormatted: formatDateForDisplay(lastYearRange.end)
                    }
                },
                growth: {
                    revenue: revenueGrowth,
                    orders: orderGrowth
                },
                hasComparison: lastYearOrders.length > 0
            };
        } catch (error) {
            console.error('Error loading YoY data:', error);
            // Return fallback data instead of throwing
            return {
                currentYear: { revenue: 0, orders: 0, dateRange: null },
                lastYear: { revenue: 0, orders: 0, dateRange: null },
                growth: { revenue: null, orders: null },
                hasComparison: false,
                error: error.message
            };
        }
    }

    /**
     * Load sales team performance data
     */
    async function loadSalesTeamPerformance(days = 30) {
        try {
            const dateRange = days === 'ytd' ? getYTDRange() : getDateRange(days);
            const orders = await fetchOrders(dateRange.start, dateRange.end);

            // Aggregate by sales rep
            const repMetrics = {};

            orders.forEach(order => {
                const rep = normalizeRepName(order.CustomerServiceRep);
                const subtotal = parseFloat(order.cur_SubTotal) || 0;

                if (!repMetrics[rep]) {
                    repMetrics[rep] = {
                        name: rep,
                        revenue: 0,
                        orders: 0,
                        initials: getInitials(rep)
                    };
                }

                repMetrics[rep].revenue += subtotal;
                repMetrics[rep].orders += 1;
            });

            // Convert to array and sort by revenue
            const repArray = Object.values(repMetrics)
                .filter(rep => rep.name !== 'Unassigned')
                .sort((a, b) => b.revenue - a.revenue);

            // Calculate percentages relative to top performer
            const maxRevenue = repArray.length > 0 ? repArray[0].revenue : 0;
            repArray.forEach(rep => {
                rep.percentage = maxRevenue > 0 ? (rep.revenue / maxRevenue) * 100 : 0;
                rep.formattedRevenue = formatCurrency(rep.revenue);
            });

            return {
                reps: repArray,
                totalReps: repArray.length,
                topPerformer: repArray[0] || null,
                period: days === 'ytd' ? 'Year to Date' : `Last ${days} days`
            };
        } catch (error) {
            console.error('Error loading team performance:', error);
            throw error;
        }
    }

    /**
     * Load order type breakdown
     */
    async function loadOrderTypeBreakdown(days = 30) {
        try {
            const dateRange = days === 'ytd' ? getYTDRange() : getDateRange(days);
            const orders = await fetchOrders(dateRange.start, dateRange.end);

            // Aggregate by order type
            const typeMetrics = {};

            orders.forEach(order => {
                const orderType = order.ORDER_TYPE || 'Other';
                const subtotal = parseFloat(order.cur_SubTotal) || 0;

                if (!typeMetrics[orderType]) {
                    typeMetrics[orderType] = {
                        type: orderType,
                        revenue: 0,
                        orders: 0
                    };
                }

                typeMetrics[orderType].revenue += subtotal;
                typeMetrics[orderType].orders += 1;
            });

            // Convert to array and sort by revenue
            const typeArray = Object.values(typeMetrics)
                .sort((a, b) => b.revenue - a.revenue);

            // Calculate percentages
            const totalRevenue = typeArray.reduce((sum, t) => sum + t.revenue, 0);
            typeArray.forEach(type => {
                type.percentage = totalRevenue > 0 ? (type.revenue / totalRevenue) * 100 : 0;
                type.formattedRevenue = formatCurrency(type.revenue);
            });

            return {
                types: typeArray,
                totalRevenue,
                period: days === 'ytd' ? 'Year to Date' : `Last ${days} days`
            };
        } catch (error) {
            console.error('Error loading order type breakdown:', error);
            throw error;
        }
    }

    // =====================================================
    // PROCESSING FUNCTIONS (work on already-fetched data)
    // =====================================================

    /**
     * Process revenue data from fetched orders
     */
    function processRevenueData(orders, dateRange, days) {
        let totalRevenue = 0;
        const totalOrders = orders.length;

        orders.forEach(order => {
            const subtotal = parseFloat(order.cur_SubTotal) || 0;
            totalRevenue += subtotal;
        });

        return {
            revenue: totalRevenue,
            orders: totalOrders,
            avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            period: days,
            dateRange: {
                start: dateRange.start,
                end: dateRange.end,
                startFormatted: formatDateForDisplay(dateRange.start),
                endFormatted: formatDateForDisplay(dateRange.end)
            }
        };
    }

    /**
     * Process YoY comparison from fetched orders
     */
    function processYearOverYear(currentOrders, lastYearOrders, currentRange, lastYearRange) {
        let currentRevenue = 0;
        let lastYearRevenue = 0;

        currentOrders.forEach(order => {
            currentRevenue += parseFloat(order.cur_SubTotal) || 0;
        });

        lastYearOrders.forEach(order => {
            lastYearRevenue += parseFloat(order.cur_SubTotal) || 0;
        });

        const revenueGrowth = lastYearRevenue > 0
            ? ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100
            : null;

        const revenueDifference = currentRevenue - lastYearRevenue;

        const orderGrowth = lastYearOrders.length > 0
            ? ((currentOrders.length - lastYearOrders.length) / lastYearOrders.length) * 100
            : null;

        return {
            currentYear: {
                revenue: currentRevenue,
                orders: currentOrders.length,
                dateRange: {
                    start: currentRange.start,
                    end: currentRange.end,
                    startFormatted: formatDateForDisplay(currentRange.start),
                    endFormatted: formatDateForDisplay(currentRange.end)
                }
            },
            lastYear: {
                revenue: lastYearRevenue,
                orders: lastYearOrders.length,
                dateRange: {
                    start: lastYearRange.start,
                    end: lastYearRange.end,
                    startFormatted: formatDateForDisplay(lastYearRange.start),
                    endFormatted: formatDateForDisplay(lastYearRange.end)
                }
            },
            growth: {
                revenue: revenueGrowth,
                revenueDifference: revenueDifference,
                orders: orderGrowth
            },
            hasComparison: lastYearOrders.length > 0
        };
    }

    /**
     * Process team performance from fetched orders with YoY comparison
     */
    function processTeamPerformance(currentOrders, lastYearOrders, dateRange, days) {
        const repMetrics = {};

        // Aggregate current period orders
        currentOrders.forEach(order => {
            const originalName = order.CustomerServiceRep;
            const rep = normalizeRepName(originalName);
            const subtotal = parseFloat(order.cur_SubTotal) || 0;

            if (!repMetrics[rep]) {
                repMetrics[rep] = {
                    name: rep,
                    revenue: 0,
                    orders: 0,
                    initials: getInitials(rep),
                    firstNames: new Set()
                };
            }

            repMetrics[rep].revenue += subtotal;
            repMetrics[rep].orders += 1;

            // Track first names for "Other" group
            if (rep === 'Other' && originalName) {
                const firstName = originalName.trim().split(' ')[0];
                if (firstName) repMetrics[rep].firstNames.add(firstName);
            }
        });

        // Aggregate last year orders for YoY comparison
        const lastYearByRep = {};
        if (lastYearOrders && lastYearOrders.length > 0) {
            lastYearOrders.forEach(order => {
                const rep = normalizeRepName(order.CustomerServiceRep);
                const subtotal = parseFloat(order.cur_SubTotal) || 0;

                if (!lastYearByRep[rep]) {
                    lastYearByRep[rep] = { revenue: 0, orders: 0 };
                }
                lastYearByRep[rep].revenue += subtotal;
                lastYearByRep[rep].orders += 1;
            });
        }

        const repArray = Object.values(repMetrics)
            .filter(rep => rep.name !== 'Unassigned')
            .sort((a, b) => b.revenue - a.revenue);

        const maxRevenue = repArray.length > 0 ? repArray[0].revenue : 0;
        repArray.forEach(rep => {
            rep.percentage = maxRevenue > 0 ? (rep.revenue / maxRevenue) * 100 : 0;
            rep.formattedRevenue = formatCurrency(rep.revenue);
            // Convert firstNames Set to comma-separated string
            if (rep.firstNames && rep.firstNames.size > 0) {
                rep.firstNamesDisplay = Array.from(rep.firstNames).join(', ');
            }

            // Calculate YoY comparison if last year data exists
            const lastYear = lastYearByRep[rep.name];
            if (lastYear && lastYear.revenue > 0) {
                rep.lastYearRevenue = lastYear.revenue;
                rep.revenueGrowth = ((rep.revenue - lastYear.revenue) / lastYear.revenue) * 100;
                rep.revenueDiff = rep.revenue - lastYear.revenue;
            }
        });

        return {
            reps: repArray,
            totalReps: repArray.length,
            topPerformer: repArray[0] || null,
            period: `Last ${days} days`,
            dateRange: dateRange ? {
                start: dateRange.start,
                end: dateRange.end,
                startFormatted: formatDateForDisplay(dateRange.start),
                endFormatted: formatDateForDisplay(dateRange.end)
            } : null
        };
    }

    /**
     * Process order type breakdown from fetched orders
     */
    function processOrderTypeBreakdown(orders, days) {
        const typeMetrics = {};

        orders.forEach(order => {
            const orderType = order.ORDER_TYPE || 'Other';
            const subtotal = parseFloat(order.cur_SubTotal) || 0;

            if (!typeMetrics[orderType]) {
                typeMetrics[orderType] = {
                    type: orderType,
                    revenue: 0,
                    orders: 0
                };
            }

            typeMetrics[orderType].revenue += subtotal;
            typeMetrics[orderType].orders += 1;
        });

        const typeArray = Object.values(typeMetrics)
            .sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = typeArray.reduce((sum, t) => sum + t.revenue, 0);
        typeArray.forEach(type => {
            type.percentage = totalRevenue > 0 ? (type.revenue / totalRevenue) * 100 : 0;
            type.formattedRevenue = formatCurrency(type.revenue);
        });

        return {
            types: typeArray,
            totalRevenue,
            period: `Last ${days} days`
        };
    }

    /**
     * Load all dashboard metrics at once
     * OPTIMIZED: Fetches orders only ONCE per period to avoid 429 rate limits
     * Previously made 5 API calls, now makes only 2
     */
    async function loadAllMetrics(days = 30) {
        isLoading = true;

        try {
            // Calculate date ranges
            const currentRange = getDateRange(days);
            const lastYearRange = getLastYearRangeForDays(days);

            // Fetch orders ONCE per period (2 API calls instead of 5)
            let currentOrders = [];
            let lastYearOrders = [];
            let fetchError = null;

            try {
                // Fetch current period - this is required
                currentOrders = await fetchOrders(currentRange.start, currentRange.end);
            } catch (e) {
                console.error('Failed to fetch current orders:', e.message);
                fetchError = e;
            }

            try {
                // Fetch last year - optional, for comparison
                lastYearOrders = await fetchOrders(lastYearRange.start, lastYearRange.end);
            } catch (e) {
                console.warn('Could not load last year data for comparison:', e.message);
                // Continue without last year data
            }

            // If we couldn't fetch current orders, return error state
            if (fetchError && currentOrders.length === 0) {
                isLoading = false;
                return {
                    revenue: null,
                    yoy: null,
                    team: null,
                    orderTypes: null,
                    fetchedAt: new Date().toISOString(),
                    period: days,
                    hasPartialData: true,
                    error: fetchError.message
                };
            }

            // Process all metrics from the same fetched data
            const revenueData = processRevenueData(currentOrders, currentRange, days);
            const yoyData = processYearOverYear(currentOrders, lastYearOrders, currentRange, lastYearRange);
            const teamData = processTeamPerformance(currentOrders, lastYearOrders, currentRange, days);
            const typeData = processOrderTypeBreakdown(currentOrders, days);

            const metrics = {
                revenue: revenueData,
                yoy: yoyData,
                team: teamData,
                orderTypes: typeData,
                fetchedAt: new Date().toISOString(),
                period: days,
                hasPartialData: lastYearOrders.length === 0 // Only partial if no comparison data
            };

            // Cache the data
            cachedData = metrics;
            lastFetchTime = Date.now();

            // Store in sessionStorage for quick reload
            try {
                sessionStorage.setItem(API_CONFIG.cacheKey, JSON.stringify(metrics));
            } catch (e) {
                console.warn('Failed to cache metrics:', e);
            }

            isLoading = false;
            return metrics;
        } catch (error) {
            isLoading = false;
            throw error;
        }
    }

    /**
     * Get cached metrics or load fresh
     */
    async function getMetrics(days = 30, forceRefresh = false) {
        // Check if we have valid cached data
        if (!forceRefresh && cachedData && lastFetchTime) {
            const age = Date.now() - lastFetchTime;
            if (age < API_CONFIG.refreshInterval && cachedData.period === days) {
                return cachedData;
            }
        }

        // Try to load from sessionStorage
        if (!forceRefresh) {
            try {
                const cached = sessionStorage.getItem(API_CONFIG.cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const cacheAge = Date.now() - new Date(parsed.fetchedAt).getTime();
                    if (cacheAge < API_CONFIG.refreshInterval && parsed.period === days) {
                        cachedData = parsed;
                        lastFetchTime = new Date(parsed.fetchedAt).getTime();
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Failed to load cached metrics:', e);
            }
        }

        // Load fresh data
        return loadAllMetrics(days);
    }

    /**
     * Clear cache and force refresh
     */
    function clearCache() {
        cachedData = null;
        lastFetchTime = null;
        try {
            sessionStorage.removeItem(API_CONFIG.cacheKey);
        } catch (e) {
            console.warn('Failed to clear cache:', e);
        }
    }

    // =====================================================
    // DAILY SALES ARCHIVE FUNCTIONS (YTD tracking)
    // Stores daily sales in Caspio to overcome ManageOrders 60-day limit
    // =====================================================

    /**
     * Fetch YTD summary from Caspio archive
     */
    async function fetchYTDFromArchive(year = new Date().getFullYear()) {
        const url = `${API_CONFIG.baseURL}/caspio/daily-sales/ytd?year=${year}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch YTD: ${response.status}`);
        return response.json();
    }

    /**
     * Fetch archived daily sales for a date range
     */
    async function fetchArchivedSales(startDate, endDate) {
        const url = `${API_CONFIG.baseURL}/caspio/daily-sales?start=${startDate}&end=${endDate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch archived sales: ${response.status}`);
        return response.json();
    }

    /**
     * Archive a single day's sales to Caspio
     */
    async function archiveDailySales(date, revenue, orderCount) {
        const url = `${API_CONFIG.baseURL}/caspio/daily-sales`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, revenue, orderCount })
        });
        if (!response.ok) throw new Error(`Failed to archive: ${response.status}`);
        return response.json();
    }

    /**
     * Ensure yesterday's sales are archived (auto-capture on dashboard load)
     * This is called each time the dashboard loads to ensure no gaps in data
     */
    async function ensureYesterdayArchived() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDate(yesterday);

        try {
            // Fetch YTD to check last archived date
            const ytd = await fetchYTDFromArchive();
            if (ytd.lastArchivedDate === yesterdayStr) {
                return { alreadyArchived: true, date: yesterdayStr };
            }

            // Fetch yesterday's orders from ManageOrders
            const orders = await fetchOrders(yesterdayStr, yesterdayStr);
            const revenue = orders.reduce((sum, o) => sum + (parseFloat(o.cur_SubTotal) || 0), 0);

            // Archive to Caspio
            await archiveDailySales(yesterdayStr, revenue, orders.length);
            console.log(`Archived ${yesterdayStr}: $${revenue.toFixed(2)} (${orders.length} orders)`);

            return { archived: true, date: yesterdayStr, revenue, orderCount: orders.length };
        } catch (error) {
            console.warn('Could not auto-archive yesterday:', error.message);
            return { error: error.message };
        }
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        // Configuration
        API_CONFIG,

        // Data loading
        loadRevenueData,
        loadYearOverYear,
        loadSalesTeamPerformance,
        loadOrderTypeBreakdown,
        loadAllMetrics,
        getMetrics,
        fetchOrders,

        // Daily Sales Archive (YTD tracking)
        fetchYTDFromArchive,
        fetchArchivedSales,
        archiveDailySales,
        ensureYesterdayArchived,

        // Cache management
        clearCache,

        // Utilities
        formatCurrency,
        formatPercentage,
        formatDate,
        formatDateForDisplay,
        getInitials,

        // State
        isLoading: () => isLoading,
        getLastFetchTime: () => lastFetchTime ? new Date(lastFetchTime) : null
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.StaffDashboardService = StaffDashboardService;
}
