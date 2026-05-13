/* =====================================================
   STAFF DASHBOARD v3 — ANNOUNCEMENTS DATA BOOTSTRAP
   Lifts the inline announcements data out of any <script>
   tag in index.html (Rule #3) by reading from the
   <script type="application/json"> block.

   The controller (announcements-controller.js) reads from
   window.staffAnnouncementsData.
   ===================================================== */
(function () {
    'use strict';
    var node = document.getElementById('staffAnnouncementsData');
    if (!node) {
        window.staffAnnouncementsData = [];
        return;
    }
    try {
        window.staffAnnouncementsData = JSON.parse(node.textContent || '[]');
    } catch (err) {
        console.error('[announcements-bootstrap] Invalid JSON in #staffAnnouncementsData:', err);
        window.staffAnnouncementsData = [];
    }
})();
