/* =====================================================
   COMPANY NUMBERS — page entry (2026-09-03)

   Boots the eight live report widgets that moved here from the staff
   dashboard, using the SAME controllers. Nothing here is new logic —
   every controller renders into the ids it always did.

   ⚠ Absolute import paths on purpose. /dashboards pages are content-hashed
   by scripts/build.js and this entry is served from /dist/dashboards/js/…
   in production; a relative "../../shared_components/…" would resolve
   under /dist and 404. Absolute paths resolve to the un-hashed source
   modules, which the server sends with no-store headers.
   ===================================================== */

import '/shared_components/js/staff-dashboard/core/dashboard-events.js';   // installs the data-action click delegator

import { initOrdersInbox, initMoneyCollected, initSamplePipeline } from '/shared_components/js/staff-dashboard/controllers/orders-inbox-controller.js';
import { initMetrics }         from '/shared_components/js/staff-dashboard/controllers/metrics-controller.js';
import { initTeamPerformance } from '/shared_components/js/staff-dashboard/controllers/team-performance-controller.js';
import { initProduction }      from '/shared_components/js/staff-dashboard/controllers/production-controller.js';
import { initEmbroideryBonus } from '/shared_components/js/staff-dashboard/controllers/embroidery-bonus-controller.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function bootstrap() {
    initProduction();        // renders from static stats — no network
    initOrdersInbox();       // quote_sessions last 7 days (paid web orders / accepted / push failures)
    initMoneyCollected();    // Order_Payments ledger totals + recent list
    initSamplePipeline();    // sample orders w/o a later order — rep call list
    initMetrics();           // ManageOrders revenue + sparkline + YoY
    initTeamPerformance();   // Caspio archive YTD per-rep
    initEmbroideryBonus();   // Q3 2026 bonus — live from ORDER_ODBC via the CRM forwarder

    // Periodic refresh of revenue (5 min). The client metricsCache TTL is
    // deliberately shorter than this interval (dashboard-store.js) so each
    // tick actually re-asks the proxy; the proxy's own cache governs quota.
    setInterval(() => {
        initMetrics().catch((err) => {
            console.warn('[company-numbers] periodic refresh failed:', err);
        });
    }, REFRESH_INTERVAL_MS);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}
