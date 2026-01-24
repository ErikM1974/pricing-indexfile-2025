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
     * Get Year-to-Date range for current year (Jan 1 to today)
     * Used for Team Performance YTD display
     * Note: Works within 60-day API limit early in year; archive system needed later
     */
    function getYTD2026Range() {
        const end = new Date();
        const year = end.getFullYear();
        return {
            start: `${year}-01-01`,
            end: formatDate(end)
        };
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
     * Process team performance for YTD display (no YoY comparison)
     * Used for fresh start at beginning of year
     */
    function processTeamPerformanceYTD(orders, dateRange) {
        const repMetrics = {};

        orders.forEach(order => {
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
            // No YoY comparison for YTD display
        });

        return {
            reps: repArray,
            totalReps: repArray.length,
            topPerformer: repArray[0] || null,
            period: '2026 YTD',
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
    // PER-REP DAILY SALES ARCHIVE FUNCTIONS
    // Archives sales broken down by sales rep for YTD tracking
    // =====================================================

    /**
     * Archive per-rep daily sales to Caspio
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Array} reps - Array of { name, revenue, orderCount }
     */
    async function archivePerRepDailySales(date, reps) {
        const url = `${API_CONFIG.baseURL}/caspio/daily-sales-by-rep`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, reps })
        });
        if (!response.ok) throw new Error(`Failed to archive per-rep: ${response.status}`);
        return response.json();
    }

    /**
     * Fetch YTD per-rep totals from Caspio archive
     * @param {number} year - Year to fetch (defaults to current year)
     * @returns {Promise<{success, year, reps, lastArchivedDate, totalRevenue, totalOrders}>}
     */
    async function fetchYTDPerRepFromArchive(year = new Date().getFullYear()) {
        const url = `${API_CONFIG.baseURL}/caspio/daily-sales-by-rep/ytd?year=${year}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch per-rep YTD: ${response.status}`);
        return response.json();
    }

    // =====================================================
    // GARMENT TRACKER CONFIGURATION AND FUNCTIONS
    // Tracks specific premium garments sold by Nika and Taneisha
    // =====================================================

    /**
     * Garment Tracker Configuration
     * Tracks premium items and Richardson caps for sales incentive tracking
     * NOTE: Bonus amounts are hidden from display but used for tooltip calculations
     */
    const GARMENT_TRACKER_CONFIG = {
        // Premium items - tracked individually with bonus per item
        premiumItems: [
            { partNumber: 'CT104670', name: 'Carhartt Storm Defender Jacket', bonus: 5 },
            { partNumber: 'EB550', name: 'Eddie Bauer Rain Jacket', bonus: 5 },
            { partNumber: 'CT103828', name: 'Carhartt Duck Detroit Jacket', bonus: 5 },
            { partNumber: 'CT102286', name: 'Carhartt Gilliam Vest', bonus: 3 },
            { partNumber: 'NF0A52S7', name: 'North Face Dyno Backpack', bonus: 2 }
        ],

        // Richardson SanMar caps - grouped as one total
        richardsonStyles: [
            '112', '112FP', '112FPR', '112PFP', '112PL', '112PT', '115',
            '168', '168P', '169', '173', '212', '220', '225', '256', '256P',
            '312', '323FPC', '326', '336', '355', '356'
        ],
        richardsonBonus: 0.50, // Per cap

        // Sales reps to track
        trackedReps: ['Nika Lao', 'Taneisha Clark'],

        // Order type filters (Custom Embroidery = 21, Order Type 41)
        orderTypeIds: [21, 41],

        // Date range - 2026 YTD
        getDateRange: function() {
            return {
                start: '2026-01-01',
                end: formatDate(new Date())
            };
        }
    };

    /**
     * Fetch line items for a specific order
     * @param {number} orderNo - The order number
     * @returns {Promise<Array>} Array of line items
     */
    async function fetchLineItems(orderNo) {
        const url = `${API_CONFIG.baseURL}/manageorders/lineitems/${orderNo}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch line items: ${response.status}`);
        }
        const data = await response.json();
        return data.result || [];
    }

    /**
     * Check if a part number matches a tracked style
     * Handles size variations like CT104670_2X, EB550_3X
     * @param {string} partNumber - The part number from line item
     * @param {string} trackedStyle - The base style to match
     * @returns {boolean}
     */
    function matchesTrackedStyle(partNumber, trackedStyle) {
        if (!partNumber) return false;
        // Exact match or starts with tracked style followed by underscore (size variant)
        return partNumber === trackedStyle ||
               partNumber.startsWith(trackedStyle + '_');
    }

    /**
     * Check if a part number is a Richardson SanMar cap
     * @param {string} partNumber - The part number from line item
     * @returns {boolean}
     */
    function isRichardsonStyle(partNumber) {
        if (!partNumber) return false;
        return GARMENT_TRACKER_CONFIG.richardsonStyles.some(style =>
            matchesTrackedStyle(partNumber, style)
        );
    }

    /**
     * Calculate total quantity from size fields
     * @param {Object} item - Line item with Size01-Size06 fields
     * @returns {number} Total quantity
     */
    function calculateLineItemQuantity(item) {
        // API returns size fields as strings, must parse to int
        return (parseInt(item.Size01) || 0) + (parseInt(item.Size02) || 0) + (parseInt(item.Size03) || 0) +
               (parseInt(item.Size04) || 0) + (parseInt(item.Size05) || 0) + (parseInt(item.Size06) || 0);
    }

    /**
     * Load garment tracker data
     * Fetches orders and line items, aggregates by rep and style
     * @returns {Promise<Object>} Tracker data with quantities and bonus totals
     */
    async function loadGarmentTrackerData() {
        const dateRange = GARMENT_TRACKER_CONFIG.getDateRange();
        const cacheKey = 'garmentTracker_2026';
        const cacheTTL = 30 * 60 * 1000; // 30 minutes

        // Check cache first
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < cacheTTL) {
                    console.log('[GarmentTracker] Using cached data');
                    return data;
                }
            }
        } catch (e) {
            console.warn('[GarmentTracker] Cache read error:', e);
        }

        console.log(`[GarmentTracker] Fetching orders from ${dateRange.start} to ${dateRange.end}`);

        // Step 1: Fetch all invoiced orders for 2026
        const allOrders = await fetchOrders(dateRange.start, dateRange.end);

        // Step 2: Filter to tracked reps AND order types 21 or 41
        const repOrders = allOrders.filter(order =>
            GARMENT_TRACKER_CONFIG.trackedReps.includes(order.CustomerServiceRep) &&
            GARMENT_TRACKER_CONFIG.orderTypeIds.includes(order.id_OrderType)
        );

        console.log(`[GarmentTracker] Found ${repOrders.length} matching orders from ${allOrders.length} total`);

        // Step 3: Initialize tracking structure
        const trackerData = {
            byRep: {},
            totals: {
                premium: {},
                richardson: 0
            },
            bonusTotals: {}, // Per-rep bonus totals for tooltips
            metadata: {
                dateRange: dateRange,
                ordersProcessed: 0,
                totalOrders: repOrders.length,
                fetchedAt: new Date().toISOString()
            }
        };

        // Initialize rep data
        GARMENT_TRACKER_CONFIG.trackedReps.forEach(rep => {
            trackerData.byRep[rep] = {
                premium: {},
                richardson: 0
            };
            trackerData.bonusTotals[rep] = 0;
            GARMENT_TRACKER_CONFIG.premiumItems.forEach(item => {
                trackerData.byRep[rep].premium[item.partNumber] = 0;
            });
        });

        // Initialize totals
        GARMENT_TRACKER_CONFIG.premiumItems.forEach(item => {
            trackerData.totals.premium[item.partNumber] = 0;
        });

        // Step 4: Fetch line items SEQUENTIALLY to avoid rate limits
        const REQUEST_DELAY = 500; // ms between requests (increased for stricter rate limits)
        const MAX_RETRIES = 5;

        for (let i = 0; i < repOrders.length; i++) {
            const order = repOrders[i];

            // Retry loop with exponential backoff
            let retries = 0;
            let success = false;

            while (!success && retries < MAX_RETRIES) {
                try {
                    const lineItems = await fetchLineItems(order.id_Order);
                    const rep = order.CustomerServiceRep;

                    lineItems.forEach(item => {
                        const qty = calculateLineItemQuantity(item);
                        if (qty === 0) return;

                        // Check premium items
                        GARMENT_TRACKER_CONFIG.premiumItems.forEach(premium => {
                            if (matchesTrackedStyle(item.PartNumber, premium.partNumber)) {
                                trackerData.byRep[rep].premium[premium.partNumber] += qty;
                                trackerData.totals.premium[premium.partNumber] += qty;
                                trackerData.bonusTotals[rep] += qty * premium.bonus;
                            }
                        });

                        // Check Richardson
                        if (isRichardsonStyle(item.PartNumber)) {
                            trackerData.byRep[rep].richardson += qty;
                            trackerData.totals.richardson += qty;
                            trackerData.bonusTotals[rep] += qty * GARMENT_TRACKER_CONFIG.richardsonBonus;
                        }
                    });

                    trackerData.metadata.ordersProcessed++;
                    success = true;
                } catch (e) {
                    retries++;
                    if (e.message.includes('429') && retries < MAX_RETRIES) {
                        // Exponential backoff: 1s, 2s, 4s
                        const backoff = Math.pow(2, retries) * 1000;
                        console.warn(`[GarmentTracker] Rate limited on order ${order.id_Order}, retry ${retries} in ${backoff}ms`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                    } else if (retries >= MAX_RETRIES) {
                        console.warn(`[GarmentTracker] Failed order ${order.id_Order} after ${MAX_RETRIES} retries:`, e.message);
                    }
                }
            }

            // Delay between requests (except after last one)
            if (i < repOrders.length - 1) {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
            }
        }

        console.log(`[GarmentTracker] Processed ${trackerData.metadata.ordersProcessed}/${repOrders.length} orders`);

        // Cache results
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                data: trackerData,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[GarmentTracker] Cache write error:', e);
        }

        return trackerData;
    }

    /**
     * Clear garment tracker cache
     */
    function clearGarmentTrackerCache() {
        try {
            sessionStorage.removeItem('garmentTracker_2026');
        } catch (e) {
            console.warn('[GarmentTracker] Cache clear error:', e);
        }
    }

    // =====================================================
    // GARMENT TRACKER - TABLE-BASED (FAST)
    // =====================================================

    /**
     * Load garment tracker data from Caspio table (FAST - ~1 second)
     * Replaces the slow 44+ API call method
     * @returns {Promise<Object>} Tracker data aggregated by rep
     */
    async function loadGarmentTrackerFromTable() {
        const year = new Date().getFullYear();
        // DateInvoiced is Date/Time field, use YEAR() function
        const whereClause = encodeURIComponent(`YEAR(DateInvoiced)=${year}`);
        const url = `${API_CONFIG.baseURL}/garment-tracker?q.where=${whereClause}`;

        console.log(`[GarmentTracker] Loading from table for year ${year}`);

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load garment tracker from table');
        }

        console.log(`[GarmentTracker] Loaded ${data.count} records from table`);

        // Aggregate records into format widget expects
        return aggregateFromTable(data.records);
    }

    /**
     * Aggregate table records by rep and premium/richardson
     * @param {Array} records - Records from garment tracker table
     * @returns {Object} Aggregated tracker data
     */
    function aggregateFromTable(records) {
        const trackerData = {
            byRep: {},
            totals: { premium: {}, richardson: 0 },
            bonusTotals: {},
            metadata: {
                ordersProcessed: records.length,
                totalOrders: records.length,
                fetchedAt: new Date().toISOString(),
                source: 'table'
            }
        };

        // Initialize tracked reps
        GARMENT_TRACKER_CONFIG.trackedReps.forEach(rep => {
            trackerData.byRep[rep] = { premium: {}, richardson: 0 };
            trackerData.bonusTotals[rep] = 0;
            GARMENT_TRACKER_CONFIG.premiumItems.forEach(item => {
                trackerData.byRep[rep].premium[item.partNumber] = 0;
            });
        });

        // Initialize totals
        GARMENT_TRACKER_CONFIG.premiumItems.forEach(item => {
            trackerData.totals.premium[item.partNumber] = 0;
        });

        // Aggregate from table records
        records.forEach(record => {
            const rep = record.RepName;
            if (!trackerData.byRep[rep]) return; // Not a tracked rep

            if (record.StyleCategory === 'Premium') {
                // Match to specific premium item
                GARMENT_TRACKER_CONFIG.premiumItems.forEach(item => {
                    if (matchesTrackedStyle(record.PartNumber, item.partNumber)) {
                        trackerData.byRep[rep].premium[item.partNumber] += record.Quantity;
                        trackerData.totals.premium[item.partNumber] += record.Quantity;
                    }
                });
            } else if (record.StyleCategory === 'Richardson') {
                trackerData.byRep[rep].richardson += record.Quantity;
                trackerData.totals.richardson += record.Quantity;
            }

            trackerData.bonusTotals[rep] += record.BonusAmount || 0;
        });

        return trackerData;
    }

    /**
     * Fetch existing garment tracker records to check for duplicates
     * @returns {Promise<Array>} Array of existing records
     */
    async function fetchExistingGarmentRecords() {
        const year = new Date().getFullYear();
        const whereClause = encodeURIComponent(`YEAR(DateInvoiced)=${year}`);
        const url = `${API_CONFIG.baseURL}/garment-tracker?q.where=${whereClause}`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.success) return [];
            return data.records || [];
        } catch (e) {
            console.warn('[GarmentTracker] Could not fetch existing records:', e.message);
            return [];
        }
    }

    /**
     * Sync orders from ManageOrders to garment tracker table
     * Skips records that already exist (prevents duplicates on re-sync)
     * @param {Function} progressCallback - Optional callback for progress updates
     * @returns {Promise<number>} Number of records synced
     */
    async function syncGarmentTracker(progressCallback) {
        const dateRange = GARMENT_TRACKER_CONFIG.getDateRange();

        // Fetch existing records to prevent duplicates
        progressCallback?.('Checking existing records...');
        const existingRecords = await fetchExistingGarmentRecords();
        const existingKeys = new Set(
            existingRecords.map(r => `${r.OrderNumber}-${r.PartNumber}`)
        );
        console.log(`[GarmentTracker] Found ${existingKeys.size} existing records`);

        progressCallback?.('Fetching orders...');
        console.log(`[GarmentTracker] Syncing orders from ${dateRange.start} to ${dateRange.end}`);

        // Get all invoiced orders for the year
        const allOrders = await fetchOrders(dateRange.start, dateRange.end);
        const repOrders = allOrders.filter(order =>
            GARMENT_TRACKER_CONFIG.trackedReps.includes(order.CustomerServiceRep) &&
            GARMENT_TRACKER_CONFIG.orderTypeIds.includes(order.id_OrderType)
        );

        progressCallback?.(`Processing ${repOrders.length} orders...`);
        console.log(`[GarmentTracker] Found ${repOrders.length} orders to sync`);

        let synced = 0;
        let skipped = 0;
        const REQUEST_DELAY = 1000; // 1 second between requests (increased for rate limits)
        const MAX_RETRIES = 5;

        for (let i = 0; i < repOrders.length; i++) {
            const order = repOrders[i];

            // Retry loop with exponential backoff
            let retries = 0;
            let success = false;

            while (!success && retries < MAX_RETRIES) {
                try {
                    const lineItems = await fetchLineItems(order.id_Order);

                    for (const item of lineItems) {
                        const qty = calculateLineItemQuantity(item);
                        if (qty === 0) continue;

                        // Check premium items
                        for (const premium of GARMENT_TRACKER_CONFIG.premiumItems) {
                            if (matchesTrackedStyle(item.PartNumber, premium.partNumber)) {
                                const recordKey = `${order.id_Order}-${item.PartNumber}`;
                                if (existingKeys.has(recordKey)) {
                                    skipped++;
                                    continue; // Skip - already synced
                                }
                                await postGarmentRecord({
                                    OrderNumber: order.id_Order,
                                    DateInvoiced: order.date_Invoiced || '',
                                    RepName: order.CustomerServiceRep,
                                    CustomerName: order.Contact_Name || '',
                                    CompanyName: order.CustomerName || '',
                                    PartNumber: item.PartNumber,
                                    StyleCategory: 'Premium',
                                    Quantity: qty,
                                    BonusAmount: qty * premium.bonus
                                });
                                synced++;
                                existingKeys.add(recordKey); // Prevent duplicates within same sync
                            }
                        }

                        // Check Richardson
                        if (isRichardsonStyle(item.PartNumber)) {
                            const recordKey = `${order.id_Order}-${item.PartNumber}`;
                            if (existingKeys.has(recordKey)) {
                                skipped++;
                                continue; // Skip - already synced
                            }
                            await postGarmentRecord({
                                OrderNumber: order.id_Order,
                                DateInvoiced: order.date_Invoiced || '',
                                RepName: order.CustomerServiceRep,
                                CustomerName: order.Contact_Name || '',
                                CompanyName: order.CustomerName || '',
                                PartNumber: item.PartNumber,
                                StyleCategory: 'Richardson',
                                Quantity: qty,
                                BonusAmount: qty * GARMENT_TRACKER_CONFIG.richardsonBonus
                            });
                            synced++;
                            existingKeys.add(recordKey); // Prevent duplicates within same sync
                        }
                    }

                    success = true;
                    progressCallback?.(`Synced ${i + 1}/${repOrders.length} orders (${synced} new, ${skipped} skipped)`);
                } catch (e) {
                    retries++;
                    if (e.message.includes('429') && retries < MAX_RETRIES) {
                        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                        const backoff = Math.pow(2, retries) * 1000;
                        console.warn(`[GarmentTracker] Rate limited on order ${order.id_Order}, retry ${retries} in ${backoff}ms`);
                        progressCallback?.(`Rate limited, waiting ${backoff/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                    } else if (retries >= MAX_RETRIES) {
                        console.warn(`[GarmentTracker] Failed order ${order.id_Order} after ${MAX_RETRIES} retries:`, e.message);
                    } else {
                        console.warn(`[GarmentTracker] Error syncing order ${order.id_Order}:`, e.message);
                        break; // Non-429 error, don't retry
                    }
                }
            }

            // Rate limit between orders
            if (i < repOrders.length - 1) {
                await new Promise(r => setTimeout(r, REQUEST_DELAY));
            }
        }

        console.log(`[GarmentTracker] Sync complete: ${synced} new, ${skipped} skipped`);
        return synced;
    }

    /**
     * Post a record to the garment tracker table
     * @param {Object} record - Record to post
     * @returns {Promise<Object>} Response from API
     */
    async function postGarmentRecord(record) {
        const response = await fetch(`${API_CONFIG.baseURL}/garment-tracker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        return response.json();
    }

    // =====================================================
    // REP CRM ACCOUNT TOTALS
    // Fetches YTD sales from each rep's CRM account table
    // =====================================================

    /**
     * Fetch CRM account totals for main sales reps
     * Returns { repName: { totalSales, accountCount } }
     * Used to show "Account Sales" alongside "Orders Processed" in Team Performance
     */
    async function fetchRepCRMTotals() {
        const repEndpoints = {
            'Nika Lao': '/api/crm-proxy/nika-accounts',
            'Taneisha Clark': '/api/crm-proxy/taneisha-accounts'
        };

        const totals = {};

        for (const [repName, endpoint] of Object.entries(repEndpoints)) {
            try {
                const response = await fetch(endpoint, { credentials: 'same-origin' });
                if (!response.ok) {
                    console.warn(`Could not fetch CRM for ${repName}: ${response.status}`);
                    totals[repName] = { totalSales: null, accountCount: 0 };
                    continue;
                }

                const data = await response.json();
                // API returns { success: true, count: X, accounts: [...] }
                const accounts = data.accounts || [];
                const totalSales = accounts.reduce((sum, acc) =>
                    sum + (parseFloat(acc.YTD_Sales_2026) || 0), 0);

                totals[repName] = {
                    totalSales,
                    accountCount: accounts.length
                };
                console.log(`[CRM Totals] ${repName}: $${totalSales.toFixed(2)} from ${accounts.length} accounts`);
            } catch (error) {
                console.warn(`Could not fetch CRM for ${repName}:`, error.message);
                totals[repName] = { totalSales: null, accountCount: 0 };
            }
        }

        return totals;
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

        // Per-Rep Daily Sales Archive (Team YTD tracking)
        archivePerRepDailySales,
        fetchYTDPerRepFromArchive,

        // Rep CRM Account Totals
        fetchRepCRMTotals,

        // Date range utilities
        getYTD2026Range,
        getDateRange,

        // Processing functions
        processTeamPerformanceYTD,

        // Cache management
        clearCache,

        // Utilities
        formatCurrency,
        formatPercentage,
        formatDate,
        formatDateForDisplay,
        getInitials,
        normalizeRepName,

        // State
        isLoading: () => isLoading,
        getLastFetchTime: () => lastFetchTime ? new Date(lastFetchTime) : null,

        // Garment Tracker (legacy - slow)
        GARMENT_TRACKER_CONFIG,
        loadGarmentTrackerData,
        clearGarmentTrackerCache,

        // Garment Tracker (table-based - fast)
        loadGarmentTrackerFromTable,
        syncGarmentTracker,
        postGarmentRecord
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.StaffDashboardService = StaffDashboardService;
}
