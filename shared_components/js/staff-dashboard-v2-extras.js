/* =====================================================
   STAFF DASHBOARD v2 — EXTRAS
   Populate #revenueStats with order count + AOV using the same
   StaffDashboardService cache that fills the big number.
   (Earlier version also handled collapsible tool categories;
   reverted 2026-04-28 — Erik wanted all categories visible.)
   ===================================================== */

(function () {
    'use strict';

    var REVENUE_STATS_ID = 'revenueStats';

    // ────────────────────────────────────────────────
    // (1) REVENUE STATS — order count + AOV
    // ────────────────────────────────────────────────

    function fmtNumber(n) {
        return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
    }
    function fmtCurrency(n) {
        if (window.StaffDashboardService && typeof StaffDashboardService.formatCurrency === 'function') {
            return StaffDashboardService.formatCurrency(n || 0);
        }
        return '$' + fmtNumber(n);
    }

    function renderRevenueStats(metrics) {
        var el = document.getElementById(REVENUE_STATS_ID);
        if (!el || !metrics || !metrics.revenue) return;
        var orders = metrics.revenue.orders || 0;
        var aov    = metrics.revenue.avgOrderValue || 0;
        if (!orders) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML =
            '<span class="stat"><span class="stat-num">' + fmtNumber(orders) + '</span> orders</span>' +
            '<span class="stat-divider" aria-hidden="true"></span>' +
            '<span class="stat"><span class="stat-num">' + fmtCurrency(aov) + '</span> AOV</span>';
    }

    function getCurrentDateRangeDays() {
        var active = document.querySelector('.date-range-btn.active');
        if (active && active.dataset && active.dataset.days) {
            var n = parseInt(active.dataset.days, 10);
            if (!isNaN(n)) return n;
        }
        return 7;
    }

    function refreshRevenueStats(forceRefresh) {
        if (!window.StaffDashboardService || typeof StaffDashboardService.getMetrics !== 'function') return;
        var days = getCurrentDateRangeDays();
        StaffDashboardService.getMetrics(days, forceRefresh === true)
            .then(renderRevenueStats)
            .catch(function () { /* legacy init already shows the error UI */ });
    }

    function wireRevenueStats() {
        if (!document.getElementById(REVENUE_STATS_ID)) return;

        // Initial paint — wait a beat so legacy init's first fetch warms the cache.
        setTimeout(refreshRevenueStats, 600);

        // Re-paint when user clicks a different range. Legacy code triggers the
        // service refetch; we just piggyback on the cached result.
        document.querySelectorAll('.date-range-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                // Wait for legacy click handler to swap .active and re-fetch.
                setTimeout(refreshRevenueStats, 250);
            });
        });

        // Re-paint when refresh button is hit.
        var refreshBtn = document.querySelector('.metrics-team-card .refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                setTimeout(function () { refreshRevenueStats(true); }, 250);
            });
        }
    }

    // ────────────────────────────────────────────────
    // BOOT
    // ────────────────────────────────────────────────

    function boot() {
        wireRevenueStats();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
