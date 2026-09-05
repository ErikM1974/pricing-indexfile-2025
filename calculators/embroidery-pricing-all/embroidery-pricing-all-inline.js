/* embroidery-pricing-all.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in calculators/embroidery-pricing-all/index.html (Rule 3, 2026.09.05.7) ──
(function () {
        var p = new URLSearchParams(window.location.search);
        if (p.get('tab') === 'contract') {
            window.location.replace('/calculators/embroidery-contract/');
        }
    })();
