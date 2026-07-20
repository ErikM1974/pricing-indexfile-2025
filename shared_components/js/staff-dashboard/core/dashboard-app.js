/* =====================================================
   STAFF DASHBOARD v3 — APP ENTRY POINT
   Single ES module that orchestrates all controllers.
   Loaded as <script type="module"> from index.html.

   Note: dashboard-events.js auto-installs its delegator on import,
   so the order here is just controller-init.
   ===================================================== */

import './dashboard-events.js';   // installs document click delegator

import { initTweaks }          from '../widgets/tweaks-fab.js';
import { initAuth }            from '../controllers/auth-controller.js';
import { initSidebar }         from '../controllers/sidebar-controller.js';
// announcements retired 2026-07-06 (Erik) — zone replaced by Orders Inbox + money widgets
import { initOrdersInbox, initMoneyCollected, initSamplePipeline } from '../controllers/orders-inbox-controller.js';
import { initSalesGoal }       from '../controllers/sales-goal-controller.js';
import { initCelebrations }    from '../controllers/celebrations-controller.js';
import { initMetrics }         from '../controllers/metrics-controller.js';
import { initTeamPerformance } from '../controllers/team-performance-controller.js';
import { initProduction }      from '../controllers/production-controller.js';
import { initGarmentTracker }  from '../controllers/garment-tracker-controller.js';
// Phase 1 "alive + personal" widgets (2026-07-20)
import { initWinBell }         from '../controllers/win-bell-controller.js';
import { initPrideWall }       from '../controllers/pride-wall-controller.js';
import { initMyStuff }         from '../controllers/my-stuff-controller.js';
// Phase 2 "effortless" layer (2026-07-20): Ctrl+K Everything Bar
import { initCommandPalette }  from '../controllers/command-palette-controller.js';

// Load custom elements (registers themselves on import)
import '../widgets/dashboard-modal.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

async function bootstrap() {
    console.log('[staff-dashboard v3] booting…');

    // Tweaks first — applies data-theme/data-accent/data-density to <body>
    // before any layout paints, avoiding theme flicker.
    initTweaks();

    // Auth runs in parallel with the rest — most controllers don't depend on it.
    const authPromise = initAuth();

    // Synchronous controller init (fast, no network)
    initSidebar();
    initSalesGoal();
    initCelebrations();
    initProduction();        // renders from static stats — no network
    initMyStuff();           // localStorage only — no network
    initCommandPalette();    // Ctrl+K — registry harvested from DOM; backend on demand

    // Async controllers — fetches from caspio-pricing-proxy
    initOrdersInbox();       // quote_sessions last 7 days (paid web orders / accepted / push failures)
    initMoneyCollected();    // Order_Payments ledger totals + recent list
    initSamplePipeline();    // sample orders w/o a later order — rep call list
    initMetrics();           // ManageOrders revenue + sparkline + YoY
    initTeamPerformance();   // Caspio archive YTD per-rep
    initGarmentTracker();    // Caspio garment-tracker table (bridged to legacy service)
    initWinBell();           // quote_sessions diff → live wins ticker + confetti
    initPrideWall();         // finished-photos library → ambient photo strip

    await authPromise;

    // Periodic refresh of revenue (5 min) — re-fetches from ShopWorks proxy.
    setInterval(() => {
        try {
            initMetrics();
        } catch (err) {
            console.warn('[staff-dashboard v3] periodic refresh failed:', err);
        }
    }, REFRESH_INTERVAL_MS);

    console.log('[staff-dashboard v3] booted.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}
