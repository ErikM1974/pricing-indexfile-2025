/**
 * Production Schedule Predictor
 *
 * Uses historical statistics from PRODUCTION_STATS to predict
 * turnaround times for different production services.
 *
 * Dependencies: production-schedule-stats.js must be loaded first
 */

(function(global) {
    'use strict';

    // Service type mappings (internal key -> display name)
    const SERVICE_NAMES = {
        dtg: 'DTG',
        dtgRush: 'DTG Rush',
        embroidery: 'Embroidery',
        capEmbroidery: 'Cap Emb',
        screenprint: 'Screen Print',
        transfers: 'Transfers'
    };

    // Season thresholds based on capacity data
    const SEASON_THRESHOLDS = {
        slow: 80,    // >= 80% wide open = slow season
        busy: 50     // < 50% wide open = busy season
    };

    /**
     * Check if a date falls on a weekend or holiday
     * @param {Date} date - Date to check
     * @returns {boolean} True if weekend or holiday
     */
    function isWeekendOrHoliday(date) {
        const day = date.getDay();
        // Check weekend (0 = Sunday, 6 = Saturday)
        if (day === 0 || day === 6) return true;

        // Check holidays (requires PRODUCTION_HOLIDAYS from production-schedule-stats.js)
        if (typeof PRODUCTION_HOLIDAYS !== 'undefined') {
            const dateStr = date.toISOString().split('T')[0];
            return PRODUCTION_HOLIDAYS.includes(dateStr);
        }
        return false;
    }

    /**
     * Calculate due date from today + days, adjusted for weekends/holidays
     * @param {number} days - Calendar days from today
     * @returns {Date} Adjusted due date (never falls on weekend/holiday)
     */
    function calculateDueDate(days) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        // Push forward if lands on weekend or holiday
        while (isWeekendOrHoliday(dueDate)) {
            dueDate.setDate(dueDate.getDate() + 1);
        }

        return dueDate;
    }

    /**
     * Format a date as "Monday, Jan 20"
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    function formatDueDate(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Get turnaround estimate for a service type
     * @param {string} serviceType - dtg, dtgRush, embroidery, capEmbroidery, screenprint, transfers
     * @param {Date} [date] - Optional date to predict for (defaults to today)
     * @returns {Object} { days, min, max, range, confidence }
     */
    function getTurnaroundEstimate(serviceType, date) {
        const targetDate = date || new Date();
        const month = targetDate.getMonth() + 1;

        // Get stats (fallback to overall if month data missing)
        const stats = typeof PRODUCTION_STATS !== 'undefined' ? PRODUCTION_STATS : null;

        if (!stats || !stats[serviceType]) {
            // Return defaults if stats not loaded
            return {
                days: 14,
                min: 10,
                max: 21,
                range: '10-21',
                confidence: 'low',
                samples: 0
            };
        }

        const monthStats = stats[serviceType].byMonth[month];
        const overallStats = stats[serviceType].overall;

        // Use month-specific data if available, otherwise overall
        const source = (monthStats && monthStats.samples > 10) ? monthStats : overallStats;

        // Calculate due date adjusted for weekends/holidays
        const days = Math.round(source.avg);
        const dueDate = calculateDueDate(days);

        return {
            days: days,
            min: source.min,
            max: source.max,
            range: `${source.min}-${source.max}`,
            confidence: source.samples > 30 ? 'high' : source.samples > 10 ? 'medium' : 'low',
            samples: source.samples,
            dueDate: dueDate,
            dueDateFormatted: formatDueDate(dueDate)
        };
    }

    /**
     * Get seasonal indicator for a given month
     * @param {Date} [date] - Optional date (defaults to today)
     * @returns {string} 'slow', 'normal', or 'busy'
     */
    function getSeasonIndicator(date) {
        const targetDate = date || new Date();
        const month = targetDate.getMonth() + 1;

        const stats = typeof PRODUCTION_STATS !== 'undefined' ? PRODUCTION_STATS : null;
        if (!stats || !stats.capacityByMonth) {
            return 'normal';
        }

        const capacity = stats.capacityByMonth[month];
        if (!capacity) return 'normal';

        const wideOpenPct = capacity.wideOpen;

        if (wideOpenPct >= SEASON_THRESHOLDS.slow) {
            return 'slow';
        } else if (wideOpenPct < SEASON_THRESHOLDS.busy) {
            return 'busy';
        }
        return 'normal';
    }

    /**
     * Get capacity status for a given month
     * @param {Date} [date] - Optional date (defaults to today)
     * @returns {Object} { status, wideOpen, moderate, soldOut }
     */
    function getCapacityStatus(date) {
        const targetDate = date || new Date();
        const month = targetDate.getMonth() + 1;

        const stats = typeof PRODUCTION_STATS !== 'undefined' ? PRODUCTION_STATS : null;
        if (!stats || !stats.capacityByMonth) {
            return { status: 'wide-open', wideOpen: 100, moderate: 0, soldOut: 0 };
        }

        const capacity = stats.capacityByMonth[month];
        if (!capacity) {
            return { status: 'wide-open', wideOpen: 100, moderate: 0, soldOut: 0 };
        }

        let status = 'wide-open';
        if (capacity.wideOpen < 50) {
            status = 'busy';
        } else if (capacity.wideOpen < 80) {
            status = 'moderate';
        }

        return {
            status,
            wideOpen: capacity.wideOpen,
            moderate: capacity.moderate,
            soldOut: capacity.soldOut
        };
    }

    /**
     * Get all predictions for all services
     * @param {Date} [date] - Optional date (defaults to today)
     * @returns {Object} Predictions keyed by service type
     */
    function getAllPredictions(date) {
        const targetDate = date || new Date();

        return {
            dtg: getTurnaroundEstimate('dtg', targetDate),
            dtgRush: getTurnaroundEstimate('dtgRush', targetDate),
            embroidery: getTurnaroundEstimate('embroidery', targetDate),
            capEmbroidery: getTurnaroundEstimate('capEmbroidery', targetDate),
            screenprint: getTurnaroundEstimate('screenprint', targetDate),
            transfers: getTurnaroundEstimate('transfers', targetDate),
            season: getSeasonIndicator(targetDate),
            capacity: getCapacityStatus(targetDate),
            month: targetDate.getMonth() + 1,
            monthName: targetDate.toLocaleString('en-US', { month: 'long' })
        };
    }

    /**
     * Get display name for a service type
     * @param {string} serviceType
     * @returns {string}
     */
    function getServiceName(serviceType) {
        return SERVICE_NAMES[serviceType] || serviceType;
    }

    /**
     * Get season display text
     * @param {string} season - 'slow', 'normal', or 'busy'
     * @returns {string}
     */
    function getSeasonText(season) {
        switch (season) {
            case 'slow': return 'Slow Season';
            case 'busy': return 'Busy Season';
            default: return 'Normal Season';
        }
    }

    /**
     * Get metadata about the statistics
     * @returns {Object}
     */
    function getMetadata() {
        const stats = typeof PRODUCTION_STATS !== 'undefined' ? PRODUCTION_STATS : null;
        if (!stats || !stats.metadata) {
            return { totalRecords: 0, dateRange: { start: null, end: null } };
        }
        return stats.metadata;
    }

    // Export as ProductionPredictor
    const ProductionPredictor = {
        getTurnaroundEstimate,
        getSeasonIndicator,
        getCapacityStatus,
        getAllPredictions,
        getServiceName,
        getSeasonText,
        getMetadata,
        calculateDueDate,
        formatDueDate,
        isWeekendOrHoliday,
        SERVICE_NAMES
    };

    // Export for browser and module environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ProductionPredictor;
    }
    global.ProductionPredictor = ProductionPredictor;

})(typeof window !== 'undefined' ? window : this);
