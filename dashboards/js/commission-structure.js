/* commission-structure.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in dashboards/commission-structure.html (Rule 3, 2026.09.05.7) ──
function toggleAccordion(header) {
            var item = header.parentElement;
            var isOpen = item.classList.contains('open');

            // Close all items
            document.querySelectorAll('.accordion-item').forEach(function(accordionItem) {
                accordionItem.classList.remove('open');
            });

            // Open clicked item if it wasn't already open
            if (!isOpen) {
                item.classList.add('open');
            }
        }
