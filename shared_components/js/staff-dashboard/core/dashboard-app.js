/* =====================================================
   STAFF DASHBOARD v3 — APP ENTRY POINT
   Single ES module that orchestrates all controllers.
   Loaded as <script type="module"> from index.html.

   Note: dashboard-events.js auto-installs its delegator on import,
   so the order here is just controller-init.

   2026-09-03 (Workspaces): the sidebar controller and the eight
   live-report controllers left this page. The reports now live on
   /dashboards/company-numbers.html (entry: dashboards/js/company-numbers.js),
   which the header goal chip opens. Team performance is still fetched
   here — not to render a card, but because it is what feeds the goal
   chip's YTD figure.
   ===================================================== */

import './dashboard-events.js';   // installs document click delegator

import { initTweaks }          from '../widgets/tweaks-fab.js';
import { initAuth }            from '../controllers/auth-controller.js';
// Collapse memory for any details[data-collapse-key] (Pride Wall, the "More" folds).
import { initToolGrid }        from '../controllers/tool-grid-controller.js';
// Role-gated nodes (2026-07-28): strips [data-requires-role] blocks the signed-in
// staffer doesn't qualify for — the Admin tab + panel, the per-rep account tiles.
import { initNavAccess }       from '../controllers/nav-access-controller.js';
// Workspaces (2026-09-03): the role-based tabs.
import { initWorkspaces }      from '../controllers/workspace-controller.js';
import { initSalesGoal }       from '../controllers/sales-goal-controller.js';
import { initCelebrations }    from '../controllers/celebrations-controller.js';
import { initTeamPerformance } from '../controllers/team-performance-controller.js';
// Phase 1 "alive + personal" widgets (2026-07-20). Win Bell removed 2026-07-23.
import { initPrideWall }       from '../controllers/pride-wall-controller.js';
import { initMyStuff }         from '../controllers/my-stuff-controller.js';
// Phase 2 "effortless" layer (2026-07-20): Ctrl+K Everything Bar
import { initCommandPalette }  from '../controllers/command-palette-controller.js';

// Load custom elements (registers themselves on import)
import '../widgets/dashboard-modal.js';

async function bootstrap() {
    // Tweaks first — applies data-theme/data-accent/data-density to <html>
    // before any layout paints, avoiding theme flicker.
    initTweaks();

    // Auth runs in parallel with the rest — most controllers don't depend on it.
    const authPromise = initAuth();

    // Role-gated nodes — kicked off first so the Admin tab and the per-rep tiles
    // resolve (revealed or removed) as early as possible. Not awaited here: the
    // workspace controller awaits it to pick the role's default tab, and the
    // command palette re-harvests its registry on each open.
    const navAccessPromise = initNavAccess();

    // Synchronous controller init (fast, no network)
    initToolGrid();          // <details> collapse memory
    initSalesGoal();
    initCelebrations();
    initMyStuff();           // localStorage only — no network
    initCommandPalette();    // Ctrl+K — registry harvested from DOM; backend on demand

    // Async fetches. Team performance renders nothing here (no #salesTeamList on
    // this page) but its YTD total is what fills the header goal chip.
    initTeamPerformance();
    initPrideWall();         // finished-photos library → ambient photo strip

    // Tabs: paints immediately, then re-targets once identity lands.
    await initWorkspaces({ permissionsPromise: navAccessPromise, authPromise });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}
