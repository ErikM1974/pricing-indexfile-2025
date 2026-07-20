/* TEST HARNESS ENTRY — test-phase1-widgets.html only.
   Imports the real Phase 1 controllers against the mocks. */
import { initWinBell } from '/shared_components/js/staff-dashboard/controllers/win-bell-controller.js';
import { initPrideWall } from '/shared_components/js/staff-dashboard/controllers/pride-wall-controller.js';
import { initMyStuff } from '/shared_components/js/staff-dashboard/controllers/my-stuff-controller.js';

initMyStuff();
initWinBell();
initPrideWall();
